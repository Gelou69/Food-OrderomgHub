// components/common/FoodButton.jsx
import React from 'react';
import { NAVY } from '../../config/constants';

export const FoodButton = ({ 
  children, 
  onClick, 
  className = '', 
  disabled = false, 
  variant = 'primary' 
}) => {
  const baseStyle = 'w-full py-3 rounded-md font-bold text-base transition-all duration-300 shadow-lg';
  let variantStyle = '';
  let customStyle = {};

  if (variant === 'primary') {
    variantStyle = 'btn-primary';
  } else {
    variantStyle = 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 shadow-md';
    customStyle = { color: NAVY };
  }
  
  const disabledStyle = disabled ? 'opacity-60 cursor-not-allowed shadow-none' : '';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${variantStyle} ${disabledStyle} ${className}`}
      style={customStyle}
    >
      {children}
    </button>
  );
};