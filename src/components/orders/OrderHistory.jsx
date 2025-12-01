// components/orders/OrderHistory.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../config/supabase';
import { ORANGE, NAVY, BORDER } from '../../config/constants';
import { Loading } from '../common/Loading';
import { SectionTitle } from '../common/SectionTitle';
import { FoodButton } from '../common/FoodButton';
import { StatusPill } from '../common/StatusPill';

export const OrderHistory = ({ setPage, user, setSelectedOrder }) => {
  // We now use `groupedOrders` because one database order might become multiple display items
  const [groupedOrders, setGroupedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const fetchOrders = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // 1. Query: Fetch orders with deep selection for restaurant data
    const { data: fetchedOrders, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          food_item_id,
          name,
          price,
          quantity,
          food_items (
            restaurant_id,
            restaurants (
              name,
              image_url
            )
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error fetching orders:", error);
      setGroupedOrders([]);
    } else {
      // 2. Process data: Group order items by restaurant within each order
      const groupedDisplayOrders = fetchedOrders.flatMap(order => {
        // Group items by restaurant_id
        const restaurantGroups = order.order_items.reduce((acc, item) => {
          const restaurant = item.food_items?.restaurants;
          const restaurantId = restaurant?.name; // Use name as the key for grouping

          if (!restaurantId) return acc; // Skip items with no restaurant data

          if (!acc[restaurantId]) {
            acc[restaurantId] = {
              restaurantName: restaurant.name,
              restaurantId: item.food_items.restaurant_id,
              items: [],
              subtotal: 0,
            };
          }

          const itemTotal = item.price * item.quantity;
          acc[restaurantId].items.push(item);
          acc[restaurantId].subtotal += itemTotal;
          return acc;
        }, {});

        // Convert the groups into an array of display objects
        const restaurantOrderSegments = Object.values(restaurantGroups).map(group => {
          // Calculate the total for this segment (items subtotal + delivery fee)
          // Note: The delivery_fee and total in the original order still represent the entire order.
          // For simplicity, we only show the item subtotal for the segment.
          // If the fee should be applied to one restaurant, more complex logic is needed.
          const segmentTotal = group.subtotal; 

          return {
            ...order,
            // Unique ID for the display list (original order ID + restaurant ID)
            displayId: `${order.id}-${group.restaurantId}`, 
            // Only this restaurant's name
            restaurantName: group.restaurantName, 
            // Only this restaurant's items
            order_items: group.items, 
            // The calculated total for this segment
            total: segmentTotal, 
            createdAt: new Date(order.created_at).toLocaleDateString('en-US', { 
              day: 'numeric', month: 'short', year: 'numeric' 
            }),
            // Mark it as a segment of the original order
            isSegment: true, 
          };
        });

        // Ensure orders with no valid items are not returned
        return restaurantOrderSegments.length > 0 ? restaurantOrderSegments : [];
      });

      setGroupedOrders(groupedDisplayOrders);
    }
    
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchOrders();
  }, [user, fetchOrders]);
  
  if (loading) return <Loading />;
  
  // Use groupedOrders for the empty state check
  if (groupedOrders.length === 0) {
    return (
      <div className="p-4 md:p-6 text-center h-full flex flex-col justify-center items-center mx-auto w-full max-w-3xl">
        <span className='text-6xl mb-4'>😴</span>
        <h2 className="text-2xl font-bold mb-6" style={{ color: NAVY }}>No Orders Yet</h2>
        <p className='text-gray-500 mb-8'>Your food order history will appear here.</p>
        <div className='w-full max-w-sm'>
          <FoodButton onClick={() => setPage('products')}>Start Ordering!</FoodButton>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 mx-auto w-full max-w-3xl">
      {/* Use groupedOrders for the count */}
      <SectionTitle icon="🛵" title={`My Iligan Orders (${groupedOrders.length} Segments)`} />
      <div className="space-y-4">
        {/* Map over the grouped orders */}
        {groupedOrders.map(order => (
          <div 
            // Use the new displayId for the key
            key={order.displayId} 
            className="bg-white p-4 rounded-xl shadow-md cursor-pointer transition-all duration-200 hover:shadow-lg hover:border"
            style={{ borderColor: ORANGE, border: '1px solid white' }}
            onClick={() => {
              // Note: You must update `setSelectedOrder` to handle the segmented data
              // If 'details' needs the original order, this logic needs adjustment.
              setSelectedOrder(order);
              setPage('details');
            }}
          >
            {/* Header: Restaurant Name & Status */}
            <div className="flex justify-between items-start border-b pb-3 mb-3" style={{borderColor: BORDER}}>
              <div className="flex flex-col">
                {/* RESTAURANT NAME (Highlighted) */}
                <h3 className="font-bold text-lg text-gray-800 leading-tight">
                  {order.restaurantName}
                </h3>
                {/* Order Meta Data */}
                <div className="flex items-center gap-2 mt-1">
                  {/* Show original order ID and segment label */}
                  <p className="text-xs text-gray-500">#{order.id.slice(-6)} (Segment)</p> 
                  <span className="text-gray-300">•</span>
                  <p className="text-xs text-gray-500">{order.createdAt}</p>
                </div>
              </div>
              <StatusPill status={order.status} size="xs" />
            </div>
            
            {/* Footer: Item Count & Total */}
            <div className='flex justify-between items-center'>
              <p className='text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-md'>
                {/* Use the segment's item count */}
                {order.order_items.length} item{order.order_items.length !== 1 ? 's' : ''}
              </p>
              <div className="text-right">
                <p className="text-xs text-gray-400 mb-0.5">Subtotal</p>
                {/* Use the segment's total/subtotal */}
                <p className="text-xl font-extrabold leading-none" style={{ color: ORANGE }}>
                  ₱{(order.total).toFixed(2)} 
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};