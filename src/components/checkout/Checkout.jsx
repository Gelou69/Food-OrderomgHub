// components/checkout/Checkout.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../config/supabase';
import { ORANGE, NAVY, BORDER, ORDER_STATUSES } from '../../config/constants';
import { SectionTitle } from '../common/SectionTitle';
import { FoodButton } from '../common/FoodButton';
import { StyledInput } from '../common/StyledInput';
import { AddressMapPreview } from './AddressMapPreview';

export const Checkout = ({ setPage, cart, setCart, user }) => {
  const [address, setAddress] = useState({ 
    name: '', phone: '', addressDetail: '', barangay: '', payment: 'COD' 
  });
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Calculates total price from cart items
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);

  // Fetches active barangays for the dropdown
  useEffect(() => {
    const fetchBarangays = async () => {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('barangay_name')
        .eq('is_active', true)
        .order('barangay_name', { ascending: true });
        
      if (data) {
        const barangayNames = data.map(b => b.barangay_name);
        setBarangays(barangayNames);
        if (barangayNames.length > 0) {
          setAddress(prev => ({ ...prev, barangay: barangayNames[0] }));
        }
      } else {
        console.error('Error fetching barangays:', error);
      }
    };
    
    fetchBarangays();
  }, []);

  // Combines address parts into a single string for the DB
  const buildShippingAddress = () => {
    const { barangay, addressDetail } = address;
    return `Iligan City, Brgy. ${barangay} • ${addressDetail}`;
  };

  const handlePlaceOrder = async () => {
    if (!user) {
      setError('User not authenticated.');
      return;
    }
    if (!address.name || !address.phone || !address.barangay || !address.addressDetail) {
      setError('Please fill in Recipient Name, Phone, Barangay, and Full Address details.');
      return;
    }
    if (cart.length === 0) {
      setError('Your cart is empty.');
      return;
    }

    setLoading(true);
    
    try {
      const shipping_address_combined = buildShippingAddress();
      
      const orderData = {
        user_id: user.id,
        total: total,
        shipping_address: shipping_address_combined,
        contact_name: address.name,
        contact_phone: address.phone,
        payment_method: address.payment,
        status: ORDER_STATUSES[0], // Typically 'Pending' or 'New'
      };

      // 1. Insert Order
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;
      if (!newOrder) throw new Error("Failed to create order, no data returned.");

      const newOrderId = newOrder.id;
      
      const itemData = cart.map(item => ({
        order_id: newOrderId,
        food_item_id: item.id, 
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }));

      // 2. Insert Order Items
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemData);
        
      if (itemsError) {
        console.error("Failed to insert items, attempting rollback...", itemsError);
        await supabase.from('orders').delete().eq('id', newOrderId);
        throw itemsError;
      }
      
      // 3. Fetch Restaurant Details for Tracking Page
      let restaurantName = 'Unknown Restaurant';
      
      if (cart.length > 0) {
        const firstFoodItemId = cart[0].id; 
        
        const { data: foodData } = await supabase
          .from('food_items')
          .select('restaurant_id')
          .eq('food_item_id', firstFoodItemId)
          .single();
          
        if (foodData && foodData.restaurant_id) {
          const { data: restData } = await supabase
            .from('restaurants')
            .select('name')
            .eq('id', foodData.restaurant_id)
            .single();
            
          if (restData) {
            restaurantName = restData.name;
          }
        }
      }
      
      // 4. Prepare Order object for Tracking Page
      const orderForTracking = {
        ...newOrder,
        order_items: itemData, // Attach the newly created items
        restaurant_name: restaurantName, // Attach the name
      };

      setCart([]);
      
      // Navigate to the tracking page with the enriched order object
      setPage('tracking', orderForTracking); 

    } catch (e) {
      console.error("Error placing order:", e);
      setError('Failed to place order. Please try again: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 mx-auto w-full max-w-3xl">
      <SectionTitle icon="🛵" title="Final Step: Confirm Delivery" />
      <div className="bg-white p-6 rounded-2xl shadow-xl space-y-6">
        
        {/* Shipping Information */}
        <div className='border-b pb-4' style={{borderColor: BORDER}}>
          <h3 className="font-bold text-lg mb-4" style={{ color: NAVY }}>
            <span className='text-xl mr-2'>🏠</span>Delivery Details
          </h3>
          
          <AddressMapPreview />
          <div className='space-y-3'>
            <StyledInput
              placeholder="Recipient Name"
              value={address.name}
              onChange={(e) => setAddress({ ...address, name: e.target.value })}
              required
            />
            <StyledInput
              type="tel"
              placeholder="Phone Number"
              value={address.phone}
              onChange={(e) => setAddress({ ...address, phone: e.target.value })}
              required
            />

            <div>
              <label className='text-xs font-semibold text-gray-600'>Barangay (Iligan City Only)</label>
              <select
                value={address.barangay}
                onChange={(e) => setAddress({ ...address, barangay: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg appearance-none bg-white font-semibold focus:ring-2 focus:ring-offset-0 input-focus-shopee"
                disabled={barangays.length === 0}
              >
                {barangays.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <StyledInput
              placeholder="Street / Unit / House No."
              value={address.addressDetail}
              onChange={(e) => setAddress({ ...address, addressDetail: e.target.value })}
              rows="3"
              isTextArea
              required
            />
          </div>
        </div>

        {/* Payment Method */}
        <div className='border-b pb-4' style={{borderColor: BORDER}}>
          <h3 className="font-bold text-lg mb-4" style={{ color: NAVY }}>
            <span className='text-xl mr-2'>💳</span>Payment Method
          </h3>
          <div className="relative">
            <select
              value={address.payment}
              onChange={(e) => setAddress({ ...address, payment: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg appearance-none bg-white font-semibold focus:ring-2 focus:ring-offset-0 input-focus-shopee"
              style={{ paddingRight: '2.5rem'}}
            >
              <option value="COD">Cash on Delivery (COD) - Preferred</option>
              <option value="E-Wallet">GCash/Maya (E-Wallet)</option>
              <option value="CreditCard">Credit/Debit Card</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="pt-2">
          <h3 className="font-bold text-lg mb-3" style={{ color: NAVY }}>
            <span className='text-xl mr-2'>🧾</span>Order Summary
          </h3>
          
          <p className="text-lg flex justify-between mb-2 text-gray-600">
            <span>Subtotal ({cart.length} items):</span>
            <span className="font-semibold">₱{total.toFixed(2)}</span>
          </p>
          <p className="text-lg flex justify-between text-gray-600 border-b pb-3 mb-3" style={{borderColor: BORDER}}>
            <span>Delivery Fee:</span>
            <span className="font-semibold">₱50.00</span>
          </p>
          <p className="text-2xl font-extrabold flex justify-between">
            <span>TOTAL:</span>
            <span style={{ color: ORANGE }}>₱{(total + 50).toFixed(2)}</span>
          </p>
        </div>
        
        {error && <p className="text-sm text-red-500 mt-4 font-medium">{error}</p>}
      </div>

      <div className="mt-6">
        <FoodButton onClick={handlePlaceOrder} disabled={loading || barangays.length === 0 || cart.length === 0}>
          {loading ? 'Processing...' : 'Place Order Now'}
        </FoodButton>
        <FoodButton onClick={() => setPage('cart')} variant='secondary' className='mt-2'>
          ← Back to Basket
        </FoodButton>
      </div>
    </div>
  );
};