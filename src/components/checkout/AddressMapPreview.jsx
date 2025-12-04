// components/checkout/AddressMapPreview.jsx
import React, { useEffect, useState, useCallback } from "react";
import { GoogleMap, Marker, useJsApiLoader, Autocomplete } from "@react-google-maps/api";
import { ORANGE } from "../../config/constants";

const libraries = ["places"];

export const AddressMapPreview = ({
  barangay,
  addressDetail,
  origin = { lat: 8.2280, lng: 124.2452 }, // default Iligan center
  onLocationChange = () => {},
}) => {
  const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_KEY, libraries });

  const [mapCenter, setMapCenter] = useState(origin);
  const [markerPos, setMarkerPos] = useState(origin);
  const [autocomplete, setAutocomplete] = useState(null);

  // Geocode text address -> set marker
  const geocodeText = useCallback(async () => {
    if (!window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    const query = `Iligan City ${barangay || ""} ${addressDetail || ""}`.trim();
    if (!query) return;
    geocoder.geocode({ address: query }, (results, status) => {
      if (status === "OK" && results[0]) {
        const loc = results[0].geometry.location;
        const coords = { lat: loc.lat(), lng: loc.lng() };
        setMapCenter(coords);
        setMarkerPos(coords);
        computeDistanceAndCallback(coords);
      }
    });
  }, [barangay, addressDetail]);

  useEffect(() => {
    geocodeText();
  }, [geocodeText]);

  // Compute distance using DistanceMatrix (returns meters/text) then callback
  const computeDistanceAndCallback = useCallback((coords) => {
    if (!window.google) {
      onLocationChange({ coords, distanceText: null, distanceKm: null });
      return;
    }

    const service = new window.google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
      {
        origins: [origin],
        destinations: [coords],
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.METRIC,
      },
      (response, status) => {
        if (status === "OK") {
          try {
            const element = response.rows[0].elements[0];
            const distanceText = element.distance ? element.distance.text : null;
            const distanceMeters = element.distance ? element.distance.value : null;
            const distanceKm = distanceMeters != null ? distanceMeters / 1000 : null;
            onLocationChange({ coords, distanceText, distanceKm });
          } catch (e) {
            onLocationChange({ coords, distanceText: null, distanceKm: null });
          }
        } else {
          onLocationChange({ coords, distanceText: null, distanceKm: null });
        }
      }
    );
  }, [origin, onLocationChange]);

  // GPS button
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert("GPS not available.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMapCenter(coords);
        setMarkerPos(coords);
        computeDistanceAndCallback(coords);
      },
      () => alert("Unable to fetch location.")
    );
  };

  const onPlaceChanged = () => {
    if (!autocomplete) return;
    const place = autocomplete.getPlace();
    if (!place.geometry || !place.geometry.location) return;
    const loc = place.geometry.location;
    const coords = { lat: loc.lat(), lng: loc.lng() };
    setMapCenter(coords);
    setMarkerPos(coords);
    computeDistanceAndCallback(coords);
  };

  if (!isLoaded) return <div className="p-4">Loading map…</div>;

  return (
    <div className="w-full rounded-lg overflow-hidden border mb-4" style={{ borderColor: ORANGE }}>
      <div className="p-2 text-center text-sm font-semibold text-white" style={{ backgroundColor: ORANGE }}>
        📍 Interactive Delivery Map
      </div>

      <div className="p-2 bg-gray-100">
        <Autocomplete onLoad={setAutocomplete} onPlaceChanged={onPlaceChanged}>
          <input
            type="text"
            defaultValue=""
            placeholder="Search street / landmark (autocomplete)"
            className="w-full p-3 border rounded-lg"
          />
        </Autocomplete>

        <button
          onClick={handleUseMyLocation}
          className="mt-2 w-full p-2 rounded-lg font-semibold"
          style={{ backgroundColor: ORANGE, color: "white" }}
        >
          📌 Use My Location
        </button>
      </div>

      <GoogleMap center={mapCenter} zoom={15} mapContainerStyle={{ width: "100%", height: "320px" }}>
        <Marker
          position={markerPos}
          draggable={true}
          onDragEnd={(e) => {
            const coords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            setMarkerPos(coords);
            computeDistanceAndCallback(coords);
          }}
        />
      </GoogleMap>
    </div>
  );
};
