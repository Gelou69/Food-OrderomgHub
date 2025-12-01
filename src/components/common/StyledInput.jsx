// components/common/StyledInput.jsx
import React from 'react';

export const StyledInput = ({ 
  type = "text", 
  placeholder, 
  value, 
  onChange, 
  rows = 1, 
  required = false, 
  isTextArea = false 
}) => {
  const commonClasses = "w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-0 transition duration-150 ease-in-out input-focus-shopee";
  
  if (isTextArea) {
    return (
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        rows={rows}
        required={required}
        className={`${commonClasses} resize-none`}
      />
    );
  }

  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required={required}
      className={commonClasses}
    />
  );
};