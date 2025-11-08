"use client";

import { MapContainer, TileLayer } from 'react-leaflet'
import { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function MapComponent() {
  const position: LatLngExpression = [25.8809069, -80.2469804]; // Miami, FL

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }}>
      <MapContainer center={position} zoom={12} style={{ width: '100%', height: '100%' }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
      </MapContainer>
    </div>
  );
}