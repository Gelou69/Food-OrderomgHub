// components/checkout/AddressMapPreview.jsx
import React, { useEffect, useState } from 'react';
import { ORANGE } from '../../config/constants';

export const AddressMapPreview = ({ barangay, addressDetail }) => {
  const [mapUrl, setMapUrl] = useState("");

  useEffect(() => {
    const base = "https://www.google.com/maps?q=";

    // Build dynamic query
    const query = `Iligan City ${barangay || ""} ${addressDetail || ""}`.trim();

    setMapUrl(
      `${base}${encodeURIComponent(query)}&output=embed`
    );
  }, [barangay, addressDetail]);

  return (
    <div className="w-full h-56 rounded-lg overflow-hidden mb-4 border" style={{ borderColor: ORANGE }}>
      <div className="p-2 text-center text-sm font-semibold text-white" style={{ backgroundColor: ORANGE }}>
        📍 Map Preview — {barangay ? barangay : "Iligan City"}
      </div>

      <iframe
        title="map-preview"
        src={mapUrl}
        className="w-full h-full"
        allowFullScreen=""
        loading="lazy"
      ></iframe>
    </div>
  );
};
