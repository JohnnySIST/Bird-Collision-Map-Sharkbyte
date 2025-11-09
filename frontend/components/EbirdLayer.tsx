import { Circle, LayerGroup, Popup } from 'react-leaflet';
import { useEffect, useState } from 'react';
import L from 'leaflet';
import { useGlobalContext } from '../context/GlobalContext';
import { fetchEbirdInBoundsSupabase } from "@/context/DataAPI_supabase";

export default function EbirdLayer() {
  const [cachedBounds, setCachedBounds] = useState<L.LatLngBounds | null>(null);
  const { bounds, zoom, ebirdRecords, setEbirdRecords } = useGlobalContext();
  const [grouped, setGrouped] = useState<Array<{ lat: number, lon: number, count: number, species: string[], dates: string[] }>>([]);

  useEffect(() => {
    if (!bounds || !zoom || zoom < 12) {
      setEbirdRecords([]);
      setCachedBounds(null);
      setGrouped([]);
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

  // Group by coordinates and count
  useEffect(() => {
    if (!ebirdRecords || ebirdRecords.length === 0) {
      setGrouped([]);
      return;
    }
    const map = new Map<string, { lat: number, lon: number, count: number, species: Set<string>, dates: string[] }>();
    ebirdRecords.forEach(e => {
      const key = `${e.lat.toFixed(5)},${e.lon.toFixed(5)}`;
      if (map.has(key)) {
        const group = map.get(key)!;
        group.count += 1;
        group.species.add(e.common_name || 'Unknown');
        if (e.date) group.dates.push(e.date);
      } else {
        map.set(key, {
          lat: e.lat,
          lon: e.lon,
          count: 1,
          species: new Set([e.common_name || 'Unknown']),
          dates: e.date ? [e.date] : []
        });
      }
    });
    setGrouped(Array.from(map.values()).map(g => ({
      lat: g.lat,
      lon: g.lon,
      count: g.count,
      species: Array.from(g.species),
      dates: g.dates
    })));
  }, [ebirdRecords]);

  // Helper to get date range
  function getDateRange(dates: string[]) {
    if (!dates.length) return '';
    const sorted = dates.slice().sort();
    return `${sorted[0]} ~ ${sorted[sorted.length - 1]}`;
  }

  return grouped.length > 0 ? (
    <LayerGroup>
      {grouped.map((g, idx) => (
        <Circle
          key={idx}
          center={[g.lat, g.lon]}
          radius={5 + g.count * 4}
          pathOptions={{ color: 'green', fillColor: 'green', fillOpacity: 0.3, weight: 0 }}
        >
          <Popup>
            <div style={{ minWidth: 180 }}>
              <strong>Species:</strong>
              <ul style={{ margin: '4px 0 8px 0', paddingLeft: 18 }}>
                {g.species.map((s, i) => (<li key={i}>{s}</li>))}
              </ul>
              <div><strong>Count:</strong> {g.count}</div>
              <div><strong>Date Range:</strong> {getDateRange(g.dates)}</div>
            </div>
          </Popup>
        </Circle>
      ))}
    </LayerGroup>
  ) : null;
}
