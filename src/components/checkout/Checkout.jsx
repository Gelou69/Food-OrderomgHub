// components/checkout/Checkout.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../config/supabase';
import { ORANGE, NAVY, BORDER, ORDER_STATUSES } from '../../config/constants';
import { SectionTitle } from '../common/SectionTitle';
import { FoodButton } from '../common/FoodButton';
import { StyledInput } from '../common/StyledInput';
import { AddressMapPreview } from './AddressMapPreview';

export const Checkout = ({ setPage, cart, setCart, user }) => {
  const [address, setAddress] = useState({
    name: '', phone: '', addressDetail: '', barangay: '', payment: 'COD'
  });
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // --- New states ---
  const [restaurants, setRestaurants] = useState([]); // loaded from supabase
  const [nearestRestaurant, setNearestRestaurant] = useState(null); // {id, name, lat, lng}
  const [deliveryZones, setDeliveryZones] = useState([]); // {barangay_name, polygon_points?}
  const [distanceText, setDistanceText] = useState('');
  const [distanceKm, setDistanceKm] = useState(null);
  const [deliveryFee, setDeliveryFee] = useState(50); // default
  const [estimatedEtaMin, setEstimatedEtaMin] = useState(null);
  const [inDeliveryArea, setInDeliveryArea] = useState(true);

  // total
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);

  // load barangays + delivery zones + restaurants
  useEffect(() => {
    const fetchInitial = async () => {
      // barangays (as before)
      const { data: zonesData, error: zErr } = await supabase
        .from('delivery_zones')
        .select('barangay_name, polygon_points, is_active')
        .eq('is_active', true);

      if (zonesData) {
        const activeBarangays = zonesData.map(z => z.barangay_name).filter(Boolean);
        setBarangays(activeBarangays);

        // store polygons (if any)
        setDeliveryZones(zonesData.map(z => ({
          barangay_name: z.barangay_name,
          polygon_points: z.polygon_points || null,
        })));

        if (activeBarangays.length > 0) {
          setAddress(prev => ({ ...prev, barangay: prev.barangay || activeBarangays[0] }));
        }
      } else {
        console.error('Error fetching zones:', zErr);
      }

      // restaurants
      const { data: restData, error: restErr } = await supabase
        .from('restaurants')
        .select('id, name, lat, lng')
        .eq('is_active', true);

      if (restData) {
        setRestaurants(restData);
      } else {
        console.error('Error fetching restaurants:', restErr);
      }
    };

    fetchInitial();
  }, []);

  // ---------- Utility helpers ----------
  const haversineKm = (a, b) => {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const sinDlat = Math.sin(dLat / 2);
    const sinDlon = Math.sin(dLon / 2);
    const x = sinDlat * sinDlat + sinDlon * sinDlon * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return R * c;
  };

  // point in polygon (ray-casting)
  const pointInPolygon = (point, polygon) => {
    if (!polygon || polygon.length < 3) return false;
    const x = point.lng, y = point.lat;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng, yi = polygon[i].lat;
      const xj = polygon[j].lng, yj = polygon[j].lat;
      const intersect = ((yi > y) !== (yj > y)) &&
                        (x < (xj - xi) * (y - yi) / (yj - yi + Number.EPSILON) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // delivery fee rules (edit as needed)
  const computeDeliveryFee = (km) => {
    if (km == null) return 50;
    if (km <= 2) return 30;
    if (km <= 5) return 50;
    return 70;
  };

  const computeEtaMinutes = (km) => {
    if (km == null) return null;
    const avgSpeedKmph = 25; // adjust as you like
    const hours = km / avgSpeedKmph;
    const mins = Math.ceil(hours * 60);
    return mins;
  };

  // Determine nearest restaurant (client-side)
  const findNearestRestaurant = (coords) => {
    if (!restaurants || restaurants.length === 0) return null;
    let best = null;
    let bestDist = Infinity;
    restaurants.forEach(r => {
      if (r.lat == null || r.lng == null) return;
      const d = haversineKm(coords, { lat: r.lat, lng: r.lng });
      if (d < bestDist) {
        bestDist = d;
        best = { ...r, distanceKm: d };
      }
    });
    return best;
  };

  // When AddressMapPreview gives us coords & distance
  const handleLocationChange = ({ coords, distanceText, distanceKm }) => {
    setDistanceText(distanceText || '');
    setDistanceKm(distanceKm);

    // find nearest restaurant to coords
    const nearest = findNearestRestaurant(coords);
    setNearestRestaurant(nearest);

    // validate delivery area via polygons or fallback to barangay list
    let allowed = true;
    if (deliveryZones && deliveryZones.length > 0) {
      // if any zone has polygons, check them; otherwise fallback below
      const zonesWithPolys = deliveryZones.filter(z => z.polygon_points && z.polygon_points.length > 2);
      if (zonesWithPolys.length > 0) {
        allowed = zonesWithPolys.some(z => pointInPolygon(coords, z.polygon_points));
      } else {
        // fallback if no polygons: check barangay membership
        allowed = barangays.includes(address.barangay);
      }
    } else {
      allowed = barangays.includes(address.barangay);
    }
    setInDeliveryArea(!!allowed);

    // delivery fee & ETA based on numeric km
    const fee = computeDeliveryFee(distanceKm);
    setDeliveryFee(fee);
    setEstimatedEtaMin(computeEtaMinutes(distanceKm));
  };

  // Build shipping address string
  const buildShippingAddress = () => {
    const { barangay, addressDetail } = address;
    return `Iligan City, Brgy. ${barangay} • ${addressDetail}`;
  };

  // Place order (saves lat/lng, distance_km, delivery_fee, ETA, restaurant_id)
  const handlePlaceOrder = async () => {
    if (!user) {
      setError('User not authenticated.');
      return;
    }
    if (!address.name || !address.phone || !address.barangay || !address.addressDetail) {
      setError('Please fill in Recipient Name, Phone, Barangay, and Full Address details.');
      return;
    }
    if (cart.length === 0) {
      setError('Your cart is empty.');
      return;
    }
    if (!inDeliveryArea) {
      setError('Delivery address is outside our delivery area.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const shipping_address_combined = buildShippingAddress();

      // Prepare order payload
      const orderPayload = {
        user_id: user.id,
        total: total,
        shipping_address: shipping_address_combined,
        contact_name: address.name,
        contact_phone: address.phone,
        payment_method: address.payment,
        status: ORDER_STATUSES[0],
        // new fields:
        shipping_lat: distanceKm != null ? null : null, // placeholder - we'll update below
        shipping_lng: distanceKm != null ? null : null,
        distance_km: distanceKm,
        delivery_fee: deliveryFee,
        estimated_eta_minutes: estimatedEtaMin,
        restaurant_id: nearestRestaurant ? nearestRestaurant.id : null,
      };

      // IMPORTANT: Acquire latest marker coords from AddressMapPreview via distanceKm presence
      // We don't have the coords in this scope directly, so instead fetch the last known marker by re-geocoding
      // Build final lat/lng by geocoding the shipping address server-side? Simpler: try geocoding client-side now.
      // We'll geocode the address here to obtain lat/lng (client-side geocoder)
      let lat = null, lng = null;
      if (typeof window !== 'undefined' && window.google && (address.addressDetail || address.barangay)) {
        const geocoder = new window.google.maps.Geocoder();
        const query = shipping_address_combined;
        // convert to Promise
        const geoPromise = () => new Promise((resolve, reject) => {
          geocoder.geocode({ address: query }, (results, status) => {
            if (status === 'OK' && results[0]) {
              const loc = results[0].geometry.location;
              resolve({ lat: loc.lat(), lng: loc.lng() });
            } else {
              resolve(null);
            }
          });
        });
        const geo = await geoPromise();
        if (geo) {
          lat = geo.lat;
          lng = geo.lng;
        }
      }

      // override lat/lng if nearestRestaurant exists and distanceKm computed from previous callback produced coords
      // However, if geocoding failed, lat/lng will be null and still insert nulls.
      if (lat) orderPayload.shipping_lat = lat;
      if (lng) orderPayload.shipping_lng = lng;

      // 1) Insert Order
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert(orderPayload)
        .select()
        .single();

      if (orderError) throw orderError;
      if (!newOrder) throw new Error("Failed to create order, no data returned.");

      const newOrderId = newOrder.id;

      // 2) Insert Order Items
      const itemData = cart.map(item => ({
        order_id: newOrderId,
        food_item_id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemData);

      if (itemsError) {
        console.error("Failed to insert items, attempting rollback...", itemsError);
        await supabase.from('orders').delete().eq('id', newOrderId);
        throw itemsError;
      }

      // 3) Prepare enriched order for tracking page
      const orderForTracking = {
        ...newOrder,
        order_items: itemData,
        restaurant_name: nearestRestaurant ? nearestRestaurant.name : 'Unknown Restaurant',
      };

      setCart([]);
      setPage('tracking', orderForTracking);

    } catch (e) {
      console.error('Error placing order:', e);
      setError('Failed to place order. Please try again: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 mx-auto w-full max-w-3xl">
      <SectionTitle icon="🛵" title="Final Step: Confirm Delivery" />
      <div className="bg-white p-6 rounded-2xl shadow-xl space-y-6">

        {/* Shipping Information */}
        <div className='border-b pb-4' style={{borderColor: BORDER}}>
          <h3 className="font-bold text-lg mb-4" style={{ color: NAVY }}>
            <span className='text-xl mr-2'>🏠</span>Delivery Details
          </h3>

          <AddressMapPreview
            barangay={address.barangay}
            addressDetail={address.addressDetail}
            origin={ nearestRestaurant ? { lat: nearestRestaurant.lat, lng: nearestRestaurant.lng } : { lat: 8.2280, lng: 124.2452 } }
            onLocationChange={(payload) => {
              // payload: { coords, distanceText, distanceKm }
              handleLocationChange(payload);
            }}
          />

          <div className='space-y-3'>
            <StyledInput
              placeholder="Recipient Name"
              value={address.name}
              onChange={(e) => setAddress({ ...address, name: e.target.value })}
              required
            />
            <StyledInput
              type="tel"
              placeholder="Phone Number"
              value={address.phone}
              onChange={(e) => setAddress({ ...address, phone: e.target.value })}
              required
            />

            <div>
              <label className='text-xs font-semibold text-gray-600'>Barangay (Iligan City Only)</label>
              <select
                value={address.barangay}
                onChange={(e) => setAddress({ ...address, barangay: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg appearance-none bg-white font-semibold focus:ring-2 focus:ring-offset-0 input-focus-shopee"
                disabled={barangays.length === 0}
              >
                {barangays.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <StyledInput
              placeholder="Street / Unit / House No."
              value={address.addressDetail}
              onChange={(e) => setAddress({ ...address, addressDetail: e.target.value })}
              rows="3"
              isTextArea
              required
            />
          </div>
        </div>

        {/* Payment Method */}
        <div className='border-b pb-4' style={{borderColor: BORDER}}>
          <h3 className="font-bold text-lg mb-4" style={{ color: NAVY }}>
            <span className='text-xl mr-2'>💳</span>Payment Method
          </h3>
          <div className="relative">
            <select
              value={address.payment}
              onChange={(e) => setAddress({ ...address, payment: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg appearance-none bg-white font-semibold focus:ring-2 focus:ring-offset-0 input-focus-shopee"
              style={{ paddingRight: '2.5rem'}}
            >
              <option value="COD">Cash on Delivery (COD) - Preferred</option>
              <option value="E-Wallet">GCash/Maya (E-Wallet)</option>
              <option value="CreditCard">Credit/Debit Card</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="pt-2">
          <h3 className="font-bold text-lg mb-3" style={{ color: NAVY }}>
            <span className='text-xl mr-2'>🧾</span>Order Summary
          </h3>

          <p className="text-lg flex justify-between mb-2 text-gray-600">
            <span>Subtotal ({cart.length} items):</span>
            <span className="font-semibold">₱{total.toFixed(2)}</span>
          </p>

          <p className="text-lg flex justify-between text-gray-600 border-b pb-3 mb-3" style={{borderColor: BORDER}}>
            <span>Delivery Fee:</span>
            <span className="font-semibold">₱{deliveryFee.toFixed(2)}</span>
          </p>

          <p className="text-sm text-gray-600 mb-2">
            {distanceText && <>🚗 Distance: <strong>{distanceText}</strong></>}
            {distanceKm != null && <span> • {distanceKm.toFixed(2)} km</span>}
          </p>

          {estimatedEtaMin != null && (
            <p className="text-sm text-gray-600 mb-3">⏱️ ETA: <strong>{estimatedEtaMin} min</strong></p>
          )}

          <p className="text-2xl font-extrabold flex justify-between">
            <span>TOTAL:</span>
            <span style={{ color: ORANGE }}>₱{(total + deliveryFee).toFixed(2)}</span>
          </p>
        </div>

        {error && <p className="text-sm text-red-500 mt-4 font-medium">{error}</p>}
        {!inDeliveryArea && <p className="text-sm text-red-600 mt-2">This address is outside our delivery area.</p>}
        {nearestRestaurant && <p className="text-sm text-gray-600 mt-2">Assigned to: <strong>{nearestRestaurant.name}</strong></p>}

      </div>

      <div className="mt-6">
        <FoodButton onClick={handlePlaceOrder} disabled={loading || barangays.length === 0 || cart.length === 0 || !inDeliveryArea}>
          {loading ? 'Processing...' : 'Place Order Now'}
        </FoodButton>
        <FoodButton onClick={() => setPage('cart')} variant='secondary' className='mt-2'>
          ← Back to Basket
        </FoodButton>
      </div>
    </div>
  );
};
