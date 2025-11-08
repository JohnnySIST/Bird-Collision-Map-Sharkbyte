"use client";
import { createContext, useContext, useState, ReactNode } from 'react';

import { LatLngBounds } from 'leaflet';

export interface GlobalContextType {
  mapCenter: [number, number] | null;
  setMapCenter: (center: [number, number] | null) => void;
  startDate: Date | null;
  endDate: Date | null;
  setStartDate: (date: Date | null) => void;
  setEndDate: (date: Date | null) => void;
  bounds: LatLngBounds | null;
  setBounds: (bounds: LatLngBounds | null) => void;
  zoom: number | null;
  setZoom: (zoom: number | null) => void;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export function GlobalProvider({ children }: { children: ReactNode }) {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [bounds, setBounds] = useState<LatLngBounds | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);

  return (
    <GlobalContext.Provider value={{ startDate, endDate, setStartDate, setEndDate, bounds, setBounds, zoom, setZoom, mapCenter, setMapCenter }}>
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
