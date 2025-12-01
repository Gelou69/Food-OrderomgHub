// components/orders/OrderTracking.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { ORANGE, NAVY, BORDER, ORDER_STATUSES } from '../../config/constants';
import { FoodButton } from '../common/FoodButton';
import { StatusPill } from '../common/StatusPill';
import { MockMap } from './MockMap';

export const OrderTracking = ({ order, setPage, user }) => {
  const [currentOrder, setCurrentOrder] = useState(order);
  const [restaurantDetails, setRestaurantDetails] = useState({
    name: currentOrder.restaurantName || 'Loading...',
    address: 'Locating restaurant...',
  });
  
  // Logic helpers
  const isCompleted = currentOrder.status === 'Delivered' || currentOrder.status === 'Completed';
  const isReceiving = ORDER_STATUSES.indexOf(currentOrder.status) === ORDER_STATUSES.indexOf('Delivered');
  const isCancellable = ORDER_STATUSES.indexOf(currentOrder.status) <= ORDER_STATUSES.indexOf('Preparing');

  // 1. ROBUST ADDRESS FETCHING LOGIC
  useEffect(() => {
    const getRestaurantInfo = async () => {
      // Step A: identify the restaurant ID and potential nested data from the first item
      const firstItem = currentOrder.order_items?.[0];
      const foodItem = firstItem?.food_items;
      const nestedRestaurant = foodItem?.restaurants;
      const restaurantId = foodItem?.restaurant_id;

      // variable to hold what we find
      let name = nestedRestaurant?.name || currentOrder.restaurantName;
      let addressStreet = nestedRestaurant?.address_street;
      let addressBarangay = nestedRestaurant?.address_barangay;

      // Step B: If we are missing address data in the props, fetch it from Supabase
      if (restaurantId && (!addressBarangay || !name)) {
        console.log("Fetching missing restaurant details...");
        const { data, error } = await supabase
          .from('restaurants')
          .select('name, address_street, address_barangay')
          .eq('id', restaurantId)
          .single();

        if (data && !error) {
          name = data.name;
          addressStreet = data.address_street;
          addressBarangay = data.address_barangay;
        }
      }

      // Step C: Format the address
      const formattedAddress = [
        addressStreet, 
        addressBarangay, 
        'Iligan City'
      ].filter(Boolean).join(', ');

      setRestaurantDetails({
        name: name || 'Unknown Restaurant',
        address: formattedAddress || 'Address not available'
      });
    };

    getRestaurantInfo();
  }, [currentOrder]); 

  // 2. STATUS UPDATE LOGIC
  const handleUpdateStatus = async (newStatus) => {
    const allowedUserUpdates = ['Cancelled', 'Completed'];
    
    // Safety check for demo purposes
    if (!allowedUserUpdates.includes(newStatus) && newStatus !== ORDER_STATUSES[ORDER_STATUSES.indexOf(currentOrder.status) + 1]) {
      console.warn(`User status update to ${newStatus} is not allowed.`);
    }

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', currentOrder.id)
        .eq('user_id', user.id);
        
      if (error) throw error;
      
      setCurrentOrder(prev => ({...prev, status: newStatus}));

    } catch(e) {
      console.error("Error updating status:", e);
    }
  };
  
  return (
    <div className="p-4 md:p-6 mx-auto w-full max-w-3xl">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4 border-b pb-4" style={{borderColor: BORDER}}>
        <h2 className="text-2xl font-bold" style={{ color: NAVY }}>Order Tracking</h2>
        <button onClick={() => setPage('history')} className="text-base font-bold flex items-center hover:underline transition-all" style={{ color: ORANGE }}>
          <span className='mr-1'>←</span> Back
        </button>
      </div>
      
      {/* RESTAURANT INFO CARD */}
      <div className="mb-4 p-4 bg-white rounded-xl shadow-sm border border-l-4" style={{borderColor: BORDER, borderLeftColor: ORANGE}}>
        <div className="flex justify-between items-start">
            <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Order From</p>
                <h3 className="text-xl font-extrabold leading-tight" style={{ color: NAVY }}>
                    {restaurantDetails.name}
                </h3>
                <div className="flex items-start mt-2">
                    <span className="text-lg mr-1">📍</span>
                    <p className="text-sm text-gray-600 font-medium">
                        {restaurantDetails.address}
                    </p>
                </div>
            </div>
            <StatusPill status={currentOrder.status} />
        </div>
      </div>

      {/* MAP & ACTIONS */}
      <div className='mb-6 p-4 bg-white rounded-xl shadow-md'>
        <div className="flex justify-between items-center mb-4">
          <p className="font-medium text-sm text-gray-600">Order ID: <span className="font-mono bg-gray-100 px-2 py-1 rounded">#{currentOrder.id.slice(-6)}</span></p>
        </div>
        
        <MockMap currentOrder={currentOrder} />
        
        <div className="mt-6 space-y-3">
          {isReceiving && (
            <FoodButton onClick={() => handleUpdateStatus('Completed')}>
              CONFIRM ORDER RECEIVED
            </FoodButton>
          )}
          
          {isCancellable && (
            <FoodButton onClick={() => handleUpdateStatus('Cancelled')} variant="secondary">
              Cancel Order
            </FoodButton>
          )}

          {/* DEMO BUTTON: Simulate status change by restaurant/rider */}
          {(!isCompleted && 
          !isCancellable && 
          currentOrder.status !== 'Cancelled' &&
          ORDER_STATUSES.indexOf(currentOrder.status) < ORDER_STATUSES.length - 2) && (
            <button
              onClick={() => handleUpdateStatus(ORDER_STATUSES[ORDER_STATUSES.indexOf(currentOrder.status) + 1])}
              className="w-full text-center text-xs py-2 border border-dashed rounded-lg font-bold opacity-60 hover:opacity-100 transition-opacity"
              style={{color: NAVY, borderColor: NAVY}}
            >
              (Demo) Advance Status to: {ORDER_STATUSES[ORDER_STATUSES.indexOf(currentOrder.status) + 1]}
            </button>
          )}
        </div>
      </div>
      
      {/* ITEMS LIST */}
      <div className="p-4 bg-white rounded-xl shadow-md mb-4">
        <h3 className="font-bold text-lg mb-3 border-b pb-2" style={{ color: NAVY }}>Items Ordered</h3>
        <div className="space-y-3">
            {currentOrder.order_items.map((item, index) => (
            <div key={item.food_item_id || index} className="flex justify-between text-gray-700">
                <div className='flex items-center gap-2'>
                    <span className='font-bold text-gray-900 border px-2 py-0.5 rounded text-sm'>x{item.quantity}</span>
                    <p className="text-base font-medium">{item.name}</p>
                </div>
                <p className="font-semibold text-base">₱{(item.price * item.quantity).toFixed(2)}</p>
            </div>
            ))}
        </div>
        
        <div className="border-t mt-4 pt-4">
             <div className="flex justify-between items-center">
                <span className="font-bold text-gray-800">TOTAL</span>
                <span className="text-xl font-extrabold" style={{ color: ORANGE }}>₱{(currentOrder.total + 50).toFixed(2)}</span>
            </div>
             <p className='text-xs text-right text-gray-400 mt-1'>Includes delivery fee</p>
        </div>
      </div>

      {/* DELIVERY DETAILS */}
      <div className="p-4 bg-white rounded-xl shadow-md text-sm">
        <h3 className="font-bold text-lg mb-3 flex items-center gap-2" style={{ color: NAVY }}>
          <span>🏠</span> Delivery Destination
        </h3>
        <div className="pl-1 space-y-2">
            <div>
                <p className="text-xs text-gray-400 uppercase font-bold">Recipient</p>
                <p className='text-gray-800 font-medium'>{currentOrder.contact_name} ({currentOrder.contact_phone})</p>
            </div>
            <div>
                <p className="text-xs text-gray-400 uppercase font-bold">Address</p>
                <p className="text-gray-800 font-medium">{currentOrder.shipping_address}</p>
            </div>
        </div>
      </div>
    </div>
  );
};