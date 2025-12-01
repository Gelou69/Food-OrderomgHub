// components/common/SectionTitle.jsx
import React from 'react';
import { NAVY } from '../../config/constants';

export const SectionTitle = ({ icon, title }) => (
  <h3 className="flex items-center text-xl font-extrabold mb-4" style={{ color: NAVY }}>
    <span className="mr-2 text-2xl">{icon}</span>
    {title}
  </h3>
);