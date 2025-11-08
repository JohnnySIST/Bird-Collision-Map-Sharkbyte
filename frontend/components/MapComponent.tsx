"use client";

import { MapContainer, TileLayer } from 'react-leaflet'
import { useState, useRef } from 'react';
import { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import BoundMonitor from './BoundMonitor';
import BuildingsLayer from './BuildingsLayer';
import SearchCity from './SearchCity';

export default function MapComponent() {
  const defaultPosition: LatLngExpression = [25.8809069, -80.2469804]; // Miami, FL
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const mapRef = useRef<any>(null);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }}>
      <SearchCity onSearch={(lat, lon) => {
        if (mapRef.current && mapRef.current.setView) {
          mapRef.current.setView([lat, lon], 12);
        }
      }} />
      <MapContainer
        center={defaultPosition}
        zoom={12}
        style={{ width: '100%', height: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <BuildingsLayer highlighted={highlighted} setHighlighted={setHighlighted} />
        <BoundMonitor />
      </MapContainer>
    </div>
  );
}