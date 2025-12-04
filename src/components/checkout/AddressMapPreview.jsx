// components/checkout/AddressMapPreview.jsx
import React from 'react';
import { ORANGE } from '../../config/constants';

export const AddressMapPreview = () => (
  <div className="w-full h-40 rounded-lg overflow-hidden mb-4 border" style={{borderColor: ORANGE}}>
    <div className='p-2 text-center text-sm font-semibold text-white' style={{backgroundColor: ORANGE}}>
      📍 Iligan City (Mock Location Pin)
    </div>
  </div>
);