// components/orders/MockMap.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { ORANGE, NAVY, MOCK_ILIGAN_CENTER, ORDER_STATUSES, MOCK_MAPS_API_KEY } from '../../config/constants';
import { Loading } from '../common/Loading';

export const MockMap = ({ currentOrder }) => {
  // ALL HOOKS MUST BE AT THE TOP - BEFORE ANY CONDITIONALS
  const [riderPos, setRiderPos] = useState(MOCK_ILIGAN_CENTER);
  const animRef = useRef(null);
  const progressRef = useRef(0);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: MOCK_MAPS_API_KEY,
  });

  const center = useMemo(() => MOCK_ILIGAN_CENTER, []);
  
  const barangayCoords = useMemo(() => {
    const baseLat = 8.2280;
    const baseLng = 124.2452;
    const offset = 0.01;
    const coords = { 'default': MOCK_ILIGAN_CENTER };
    const barangayNames = [
      'Abuno', 'Acmac', 'Bagong Silang', 'Bonbonon', 'Bunawan', 'Buru-un', 
      'Dalipuga', 'Del Carmen', 'Digkilaan', 'Ditucalan', 'Dulag', 'Hinaplanon', 
      'Hindang', 'Kabacsanan', 'Kalilangan', 'Kiwalan', 'Lanipao', 'Luinab', 
      'Mahayahay', 'Mainit', 'Mandulog', 'Maria Cristina', 'Palao', 'Panoroganan', 
      'Poblacion', 'Puga-an', 'Rogongon', 'San Miguel', 'San Roque', 'Santiago', 
      'Saray', 'Santa Elena', 'Santa Filomena', 'Santo Rosario', 'Suarez', 
      'Tambacan', 'Tibanga', 'Tipanoy', 'Tomas L. Cabili', 'Tubod', 'Ubaldo Laya', 
      'Upper Hinaplanon', 'Upper Tominobo', 'Villa Verde'
    ];
    barangayNames.forEach((b, index) => {
      if (!coords[b]) {
        coords[b] = { 
          lat: baseLat + (index % 5) * offset * 0.1, 
          lng: baseLng + (Math.floor(index / 5) % 5) * offset * 0.1 
        };
      }
    });
    return coords;
  }, []);

  const destinationCoords = useMemo(() => {
    const addressText = (currentOrder.shipping_address || '').toString();
    let foundKey = 'default';
    for (const k of Object.keys(barangayCoords)) {
      if (k !== 'default' && addressText.includes(`Brgy. ${k}`)) {
        foundKey = k;
        break;
      }
    }
    return barangayCoords[foundKey] || barangayCoords['default'];
  }, [currentOrder.shipping_address, barangayCoords]);

  // Calculate status flags
  const isCompleted = currentOrder.status === 'Delivered' || currentOrder.status === 'Completed';
  const isShipped = ORDER_STATUSES.indexOf(currentOrder.status) >= ORDER_STATUSES.indexOf('Out for Delivery');
  
  const MOCK_ORIGIN = "Iligan City, Lanao del Norte, Philippines";
  const MOCK_DESTINATION = currentOrder.shipping_address;
  
  const containerStyle = {
    width: '100%',
    height: '200px'
  };

  const trackingText = isCompleted 
    ? "Order Delivered Successfully!" 
    : isShipped 
      ? "Tracking: Rider is en route to your location."
      : "Pending: Restaurant is preparing your food.";

  const statusIndex = ORDER_STATUSES.indexOf(currentOrder.status);
  const maxProgressIndex = ORDER_STATUSES.indexOf('Delivered');
  const progressPercent = maxProgressIndex > 0 
    ? Math.min(100, Math.max(0, (statusIndex / maxProgressIndex) * 100))
    : 0;

  const mapCenter = isShipped ? destinationCoords : center;

  const riderSvg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="20" fill="${encodeURIComponent(ORANGE)}" stroke="#fff" stroke-width="2"/>
      <path fill="#fff" d="M18 25c0 1.66 1.34 3 3 3s3-1.34 3-3V19h-6v6zm6 0c0 1.66 1.34 3 3 3s3-1.34 3-3V19h-6v6zM24 8c-4.42 0-8 3.58-8 8v16h16V16c0-4.42-3.58-8-8-8z"/>
      <text x="24" y="30" font-family="Arial" font-size="12" fill="#fff" text-anchor="middle">🛵</text>
    </svg>
  `);
  
  const riderIcon = {
    url: `data:image/svg+xml;utf8,${riderSvg}`,
    scaledSize: { width: 48, height: 48 },
    anchor: { x: 24, y: 24 },
  };

  // Animation effect
  useEffect(() => {
    setRiderPos(center);
    progressRef.current = isShipped ? 0 : 0;
    
    if (!isShipped || isCompleted) {
      if (animRef.current) {
        clearInterval(animRef.current);
        animRef.current = null;
      }
      return;
    }

    const duration = 8000;
    const stepMs = 50;
    const steps = Math.max(1, Math.floor(duration / stepMs));
    let step = 0;

    if (animRef.current) {
      clearInterval(animRef.current);
      animRef.current = null;
    }
    
    animRef.current = setInterval(() => {
      step++;
      const t = Math.min(1, step / steps);
      progressRef.current = t;
      const lat = center.lat + (destinationCoords.lat - center.lat) * t;
      const lng = center.lng + (destinationCoords.lng - center.lng) * t;
      setRiderPos({ lat, lng });

      if (t >= 1) {
        clearInterval(animRef.current);
        animRef.current = null;
      }
    }, stepMs);

    return () => {
      if (animRef.current) {
        clearInterval(animRef.current);
        animRef.current = null;
      }
    };
  }, [isShipped, destinationCoords.lat, destinationCoords.lng, center.lat, center.lng, isCompleted, center]);

  // RENDER BASED ON LOAD STATE
  if (loadError) {
    return (
      <div className="h-48 bg-red-100 rounded-xl flex items-center justify-center text-center p-4">
        <p className='text-red-700 font-bold'>Map Error: Check your Google Maps API Key!</p>
      </div>
    );
  }
  
  if (!isLoaded) {
    return (
      <div className="h-48 bg-gray-100 rounded-xl flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 border rounded-xl bg-white shadow-inner">
      <h4 className="font-bold mb-2 text-lg" style={{ color: NAVY }}>Tracking Status</h4>
      <div className="relative">
        <div className="rounded-t-lg overflow-hidden border-b-2" style={{borderColor: NAVY}}>
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={isShipped ? riderPos : mapCenter}
            zoom={isShipped ? 14 : 12}
            options={{
              disableDefaultUI: true,
              zoomControl: true,
            }}
          >
            <Marker 
              position={center}
              label={{
                text: 'Shop',
                className: 'map-label-origin',
                color: 'white'
              }}
            />
            
            <Marker 
              position={destinationCoords}
              label={{
                text: 'You',
                className: 'map-label-destination',
                color: 'white'
              }}
            />

            {isShipped && !isCompleted && (
              <Marker
                position={riderPos}
                icon={riderIcon}
              />
            )}
          </GoogleMap>
        </div>
        
        {isShipped && !isCompleted && (
          <div className="absolute top-0 left-0 right-0 h-1 rounded-full z-10" style={{backgroundColor: NAVY}}>
            <div 
              className="h-full rounded-full transition-all duration-1000"
              style={{ 
                width: `${progressPercent}%`, 
                backgroundColor: ORANGE 
              }}
            ></div>
          </div>
        )}
        
        <div className="relative bottom-0 left-0 right-0 text-center py-2 rounded-b-lg text-white font-bold" 
          style={{ backgroundColor: isShipped ? ORANGE : NAVY }}>
          {trackingText}
        </div>
      </div>
      <div className="mt-3 text-sm text-gray-600">
        <p>Delivery Partner: Local Iligan Rider (Mock)</p>
        <p>Reference No: FOOD-ILIGAN-{currentOrder.id.slice(0, 8).toUpperCase()}</p>
        <p className='font-semibold mt-1'>Source: {MOCK_ORIGIN} | Destination: {MOCK_DESTINATION}</p>
      </div>
    </div>
  );
};