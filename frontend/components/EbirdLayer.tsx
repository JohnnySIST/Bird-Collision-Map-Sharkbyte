import { Circle, LayerGroup } from 'react-leaflet';
import { useEffect, useState } from 'react';
import L from 'leaflet';
import { useGlobalContext } from '../context/GlobalContext';
import { fetchEbirdInBoundsSupabase } from "@/context/DataAPI_supabase";

export default function EbirdLayer() {
  const [cachedBounds, setCachedBounds] = useState<L.LatLngBounds | null>(null);
  const { bounds, zoom, ebirdRecords, setEbirdRecords } = useGlobalContext();

  useEffect(() => {
    if (!bounds || !zoom || zoom < 12) {
      setEbirdRecords([]);
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
    fetchEbirdInBoundsSupabase({
      north: expandedBounds.getNorth(),
      south: expandedBounds.getSouth(),
      east: expandedBounds.getEast(),
      west: expandedBounds.getWest()
    }).then(data => {
      setEbirdRecords(data);
      setCachedBounds(expandedBounds);
    });
  }, [bounds, zoom]);

  return ebirdRecords && ebirdRecords.length > 0 ? (
    <LayerGroup>
      {ebirdRecords.map(e => (
        <Circle
          key={e.id}
          center={[e.lat, e.lon]}
          radius={5}
          pathOptions={{ color: 'green', fillColor: 'green', fillOpacity: 0.5, weight: 0 }}
        />
      ))}
    </LayerGroup>
  ) : null;
}
