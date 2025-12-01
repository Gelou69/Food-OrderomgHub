// config/constants.js
export const ORANGE = 'var(--shopee-orange)';
export const NAVY = 'black';
export const LIGHT_BG = 'var(--shopee-light-bg)';
export const GRAY_TEXT = 'var(--shopee-gray-text)';
export const BORDER = 'var(--shopee-border)';

export const MOCK_ILIGAN_CENTER = { lat: 8.2280, lng: 124.2452 };

export const ORDER_STATUSES = [
  'Preparing', 
  'Out for Delivery', 
  'Delivered', 
  'Completed', 
  'Cancelled',
];

export const MOCK_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY_HERE';