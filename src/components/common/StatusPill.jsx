// components/common/StatusPill.jsx - ALREADY CORRECT
import React from 'react';
// ... imports ...

export const StatusPill = ({ status, size = 'sm' }) => {
  // Define colors for the new, descriptive statuses
  const statusColors = {
    'Pending': { bg: '#FEF3C7', text: '#F59E0B' }, // Orange - Waiting for acceptance
    'Preparing': { bg: '#E0F2F7', text: '#003366' }, // Navy/Blue - Accepted and working
    'Driver Assigned': { bg: '#DBEAFE', text: '#3B82F6' }, // Light Blue - Driver is en route to restaurant
    'Out for Delivery': { bg: '#DBEAFE', text: '#3B82F6' }, // Light Blue - In Transit
    'Delivered': { bg: '#D1FAE5', text: '#10B981' }, // Green - Delivered to customer
    'Completed': { bg: '#D1FAE5', text: '#10B981' }, // Green - Finalized
    'Cancelled': { bg: '#FEE2E2', text: '#EF4444' }, // Red - Cancelled
    // Fallback for old/unrecognized statuses, adjust as needed
    'Processing': { bg: '#FEF3C7', text: '#F59E0B' }, 
  };
  
  // Fallback to a default color if status is unrecognized
  const color = statusColors[status] || { bg: '#F3F4F6', text: '#6B7280' };
  const sizeClass = size === 'xs' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1';

  return (
    <span 
      className={`${sizeClass} font-bold rounded-full`}
      style={{ backgroundColor: color.bg, color: color.text }}
    >
      {status}
    </span>
  );
};