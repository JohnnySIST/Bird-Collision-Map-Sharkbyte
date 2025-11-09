import { useEffect, useState } from 'react';
import L from 'leaflet';
import { useGlobalContext } from '../context/GlobalContext';
import { fetchWeatherInBoundsSupabase } from "@/context/DataAPI_supabase";

export default function WeatherLayer() {
  const [cachedBounds, setCachedBounds] = useState<L.LatLngBounds | null>(null);
  const { bounds, zoom, weatherRecords, setWeatherRecords } = useGlobalContext();

  useEffect(() => {
    if (!bounds || !zoom || zoom < 12) {
      setWeatherRecords([]);
      setCachedBounds(null);
      return;
    }
    if (cachedBounds && cachedBounds.contains(bounds)) {
      return;
    }
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const latDiff = ne.lat - sw.lat;
    const lngDiff = ne.lng - sw.lng;
    const expandLat = latDiff * 0.5;
    const expandLng = lngDiff * 0.5;
    const expandedBounds = L.latLngBounds(
      [sw.lat - expandLat, sw.lng - expandLng],
      [ne.lat + expandLat, ne.lng + expandLng]
    );
    fetchWeatherInBoundsSupabase({
      north: expandedBounds.getNorth(),
      south: expandedBounds.getSouth(),
      east: expandedBounds.getEast(),
      west: expandedBounds.getWest()
    }).then(data => {
      setWeatherRecords(data);
      setCachedBounds(expandedBounds);
    });
  }, [bounds, zoom]);

  return null;
}
