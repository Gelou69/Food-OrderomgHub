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
            food_item_id,
            image_url,
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
      // Resolve item image URLs (from nested food_items or storage paths)
      const bucketsToTry = ['food-images', 'restaurant-images'];

      const resolveImage = async (raw) => {
        if (!raw) return null;
        let value = raw;
        if (typeof value === 'object') {
          value = value.url || value.path || value.publicUrl || value.public_url || value.publicURL || null;
        }
        if (!value) return null;
        value = String(value).trim();
        if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
        // normalize
        const key = value.replace(/^\/+/, '');
        for (const bucket of bucketsToTry) {
          try {
            const { data } = supabase.storage.from(bucket).getPublicUrl(key);
            const publicUrl = data?.publicUrl || data?.publicURL || data?.public_url || data?.url;
            if (publicUrl) return publicUrl;
          } catch (e) {
            // try next
          }
        }
        return null;
      };

      const groupedDisplayOrders = (await Promise.all(fetchedOrders.map(async order => {
        // Normalize and enrich items with image_url
        const enrichedItems = await Promise.all((order.order_items || []).map(async item => {
          const raw = item.food_items?.image_url || item.image_url || null;
          const image_url = await resolveImage(raw);
          return { ...item, image_url };
        }));

        // Group items by restaurant_id/name
        const restaurantGroups = enrichedItems.reduce((acc, item) => {
          const restaurant = item.food_items?.restaurants;
          const restaurantId = restaurant?.name;
          if (!restaurantId) return acc;
          if (!acc[restaurantId]) {
            acc[restaurantId] = {
              restaurantName: restaurant.name,
              restaurantId: item.food_items?.restaurant_id,
              items: [],
              subtotal: 0,
            };
          }
          const itemTotal = item.price * item.quantity;
          acc[restaurantId].items.push(item);
          acc[restaurantId].subtotal += itemTotal;
          return acc;
        }, {});

        const restaurantOrderSegments = Object.values(restaurantGroups).map(group => ({
          ...order,
          displayId: `${order.id}-${group.restaurantId}`,
          restaurantName: group.restaurantName,
          order_items: group.items,
          total: group.subtotal,
          createdAt: new Date(order.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
          isSegment: true,
        }));

        return restaurantOrderSegments.length > 0 ? restaurantOrderSegments : [];
      }))).flat();

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
        {groupedOrders.map(order => {
          const firstItem = order.order_items?.[0];
          return (
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

            {/* Item preview: show first item's image and name */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                {firstItem?.image_url ? (
                  <img src={firstItem.image_url} alt={firstItem.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-xs text-gray-400">No image</div>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{firstItem?.name || 'Unknown item'}</p>
                <p className="text-xs text-gray-500">x{firstItem?.quantity || 1}</p>
              </div>
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