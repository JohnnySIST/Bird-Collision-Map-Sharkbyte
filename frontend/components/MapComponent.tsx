"use client";

import { MapContainer, TileLayer } from 'react-leaflet'
import { useState, useRef, useEffect } from 'react';
import { LatLngExpression, LatLng } from 'leaflet';
import { useSearchParams, useRouter } from 'next/navigation';
import 'leaflet/dist/leaflet.css';
import BoundMonitor from './BoundMonitor';
import BuildingsLayer from './BuildingsLayer';
import SearchCity from './SearchCity';
import CollisionsLayer from './CollisionsLayer';
import WeatherLayer from './WeatherLayer';
import EbirdLayer from './EbirdLayer';
import { useGlobalContext } from '../context/GlobalContext';

export default function MapComponent() {
  const searchParams = useSearchParams();
  const lat = parseFloat(searchParams.get('lat') || '25.8809069');
  const lon = parseFloat(searchParams.get('lon') || '-80.2469804');
  const zoomParam = parseInt(searchParams.get('zoom') || '12', 10);
  const defaultPosition: LatLngExpression = [lat, lon];
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const mapRef = useRef<any>(null);
  const { setMapCenter } = useGlobalContext();

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }}>
      <SearchCity onSearch={(lat, lon) => {
        if (mapRef.current && mapRef.current.setView) {
          mapRef.current.setView([lat, lon], 12);
          setMapCenter(new LatLng(lat, lon));
        }
      }} />
      <MapContainer
        center={defaultPosition}
        zoom={zoomParam}
        style={{ width: '100%', height: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <BuildingsLayer highlighted={highlighted} setHighlighted={setHighlighted} />
        <WeatherLayer />
        <EbirdLayer />
        <BoundMonitor />
        <CollisionsLayer />
      </MapContainer>
    </div>
  );
}