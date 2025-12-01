// components/common/Loading.jsx
import React from 'react';
import { ORANGE, NAVY } from '../../config/constants';

export const Loading = () => (
  <div className="flex items-center justify-center p-8 h-full w-full">
    <div 
      className="animate-spin rounded-full h-10 w-10 border-4 border-t-transparent" 
      style={{borderColor: ORANGE}}
    ></div>
    <span className="ml-4 text-lg font-medium" style={{color: NAVY}}>
      Loading Iligan Food...
    </span>
  </div>
);