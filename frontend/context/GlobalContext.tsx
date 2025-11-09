"use client";
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

import { LatLngBounds, LatLng } from 'leaflet';

export interface GlobalContextType {
  mapCenter: LatLng | null;
  setMapCenter: (center: LatLng | null) => void;
  startDate: Date | null;
  endDate: Date | null;
  setStartDate: (date: Date | null) => void;
  setEndDate: (date: Date | null) => void;
  bounds: LatLngBounds | null;
  setBounds: (bounds: LatLngBounds | null) => void;
  zoom: number | null;
  setZoom: (zoom: number | null) => void;
  collisions: any[];
  setCollisions: (collisions: any[]) => void;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export function GlobalProvider({ children }: { children: ReactNode }) {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [bounds, setBounds] = useState<LatLngBounds | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLng | null>(null);
  const [collisions, setCollisions] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && mapCenter) {
      const url = new URL(window.location.href);
      url.searchParams.set('lat', mapCenter.lat.toString());
      url.searchParams.set('lon', mapCenter.lng.toString());
      url.searchParams.set('zoom', zoom?.toString() || '');
      window.history.replaceState({}, '', url.toString());
    }
  }, [mapCenter]);

  return (
  <GlobalContext.Provider value={{ startDate, endDate, setStartDate, setEndDate, bounds, setBounds, zoom, setZoom, mapCenter, setMapCenter, collisions, setCollisions }}>
      {children}
    </GlobalContext.Provider>
  );
}

export function useGlobalContext() {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('useGlobalContext must be used within a GlobalProvider');
  }
  return context;
}
