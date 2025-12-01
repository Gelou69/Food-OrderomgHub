// OrderTracking.jsx
import React, { useState } from 'react';
import { ShopeeButton } from './App'; // Assuming App.js exports utility components
import { ORDER_STATUSES } from './App'; // Assuming App.js exports the status array

// Destructure colors for local use. Assuming App.js passes them or they are imported.
const ORANGE = 'var(--shopee-orange)';
const NAVY = 'var(--shopee-navy)';
const BORDER = 'var(--shopee-border)';
const GRAY_TEXT = 'var(--shopee-gray-text)';

// Status Indicator Component (reused from App.js)
const StatusPill = ({ status }) => {
    const statusColors = {
        'To Ship': { bg: '#FFECEC', text: ORANGE },
        'Shipped': { bg: '#FFF5E0', text: '#FF9900' },
        'To Receive': { bg: '#E6F7FF', text: '#00BFFF' },
        'Completed': { bg: '#E6FFFA', text: '#00C46A' },
        'Cancelled': { bg: '#F5F5F5', text: GRAY_TEXT },
    };
    const color = statusColors[status] || statusColors['To Ship'];
    return (
        <span className="text-sm font-bold px-3 py-1 rounded-full" 
            style={{ backgroundColor: color.bg, color: color.text }}>
            {status}
        </span>
    );
};

// Mock Google Map for tracking (reused from App.js)
const MockMap = ({ currentOrder }) => {
    const isCompleted = currentOrder.status === 'Completed';
    const isShipped = ORDER_STATUSES.indexOf(currentOrder.status) >= ORDER_STATUSES.indexOf('Shipped');

    const trackingText = isCompleted 
        ? "Order Delivered Successfully!" 
        : isShipped 
            ? "Tracking: Package en route to your location."
            : "Pending Shipment: Awaiting seller processing.";

    return (
        <div className="mt-4 p-4 border rounded-xl bg-white shadow-inner">
            <h4 className="font-bold mb-2 text-lg" style={{ color: NAVY }}>Tracking Status</h4>
            <div className="relative">
                {/* Placeholder for map/image */}
                <div className="h-28 bg-gray-100 rounded-t-lg flex items-center justify-center">
                    <span className="text-gray-400">Map View Placeholder</span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 text-center py-2 rounded-b-lg text-white font-bold" 
                    style={{ backgroundColor: isShipped ? ORANGE : NAVY }}>
                    {trackingText}
                </div>
            </div>
            <div className="mt-3 text-sm text-gray-600">
                <p>Courier: J&T Express (Mock)</p>
                <p>Tracking ID: SHOPEE-MOCK-{currentOrder.id.slice(0, 8).toUpperCase()}</p>
            </div>
        </div>
    );
};


const OrderTracking = ({ order, setPage, user, supabase }) => {
    const [currentOrder, setCurrentOrder] = useState(order);

    const isCompleted = currentOrder.status === 'Completed';
    const isReceiving = ORDER_STATUSES.indexOf(currentOrder.status) === ORDER_STATUSES.indexOf('To Receive');
    const isCancellable = ORDER_STATUSES.indexOf(currentOrder.status) <= ORDER_STATUSES.indexOf('To Ship');

    const handleUpdateStatus = async (newStatus) => {
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
            <div className="flex justify-between items-center mb-4 border-b pb-4" style={{borderColor: BORDER}}>
                <h2 className="text-2xl font-bold" style={{ color: NAVY }}>Order Details & Tracking</h2>
                <button onClick={() => setPage('history')} className="text-base font-bold flex items-center hover:underline" style={{ color: ORANGE }}>
                    <span className='mr-1'>←</span> All Orders
                </button>
            </div>

            <div className='mb-6 p-4 bg-white rounded-xl shadow-md'>
                <div className="flex justify-between items-center mb-4">
                    <p className="font-medium text-sm text-gray-600">Order ID: **{currentOrder.id.slice(-8)}**</p>
                    <StatusPill status={currentOrder.status} />
                </div>
                <MockMap currentOrder={currentOrder} />
                
                <div className="mt-6 space-y-3">
                    {/* Action Buttons */}
                    {isReceiving && (
                        <ShopeeButton onClick={() => handleUpdateStatus('Completed')}>
                            CONFIRM ORDER RECEIVED
                        </ShopeeButton>
                    )}
                    {isCancellable && (
                        <ShopeeButton onClick={() => handleUpdateStatus('Cancelled')} variant="secondary">
                            Cancel Order
                        </ShopeeButton>
                    )}

                    {/* Seller Simulation Button (for demo purposes) */}
                    {(!isCompleted && 
                    !isCancellable && ORDER_STATUSES.indexOf(currentOrder.status) < ORDER_STATUSES.length - 2) && (
                        <button
                            onClick={() => handleUpdateStatus(ORDER_STATUSES[ORDER_STATUSES.indexOf(currentOrder.status) + 1])}
                            className="w-full text-center text-sm py-2 border-2 border-dashed rounded-lg font-bold"
                            style={{color: NAVY, borderColor: NAVY, opacity: 0.7}}
                            title="Click to simulate seller/courier action"
                        >
                            [DEMO] Next Status: {ORDER_STATUSES[ORDER_STATUSES.indexOf(currentOrder.status) + 1]}
                        </button>
                    )}
                </div>
            </div>
            
            {/* Items Summary */}
            <div className="p-4 bg-white rounded-xl shadow-md mb-4">
                <h3 className="font-bold text-lg mb-3" style={{ color: NAVY }}>Items Ordered</h3>
                {currentOrder.order_items.map((item, index) => (
                    <div key={index} className="flex justify-between border-b last:border-b-0 py-2 text-gray-700">
                        <p className="text-base font-medium">{item.name} x{item.quantity}</p>
                        <p className="font-semibold text-base">${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                ))}
                <p className="text-xl text-black font-extrabold flex justify-between pt-4 mt-2">
                    <span>FINAL TOTAL:</span>
                    <span style={{ color: ORANGE }}>${currentOrder.total.toFixed(2)}</span>
                </p>
            </div>

            {/* Address */}
            <div className="p-4 bg-white rounded-xl shadow-md text-sm">
                <h3 className="font-bold text-lg mb-2" style={{ color: NAVY }}><span className='mr-1'>🏠</span>Delivery Details</h3>
                <p className='text-gray-700'>**Recipient:** {currentOrder.contact_name}</p>
                <p className='text-gray-700'>**Phone:** {currentOrder.contact_phone}</p>
                <p className="text-gray-600 mt-1">**Address:** {currentOrder.shipping_address}</p>
            </div>
        </div>
    );
};

export default OrderTracking;   