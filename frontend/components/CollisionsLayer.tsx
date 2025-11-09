import { Circle, LayerGroup } from 'react-leaflet';
import { useEffect, useState } from 'react';
import L from 'leaflet';
import { useGlobalContext } from '../context/GlobalContext';
import { fetchCollisionsInBounds } from '../context/DataAPI';
import { fetchAllCollisions } from "@/context/DataAPI_supabase";

export default function CollisionsLayer() {
  const [cachedBounds, setCachedBounds] = useState<L.LatLngBounds | null>(null);
  const { bounds, zoom, collisions, setCollisions } = useGlobalContext();

  useEffect(() => {
    if (!bounds || !zoom || zoom < 12) {
      setCollisions([]);
      setCachedBounds(null);
      return;
    }
    console.log('Current bounds:', bounds);

    if (cachedBounds && cachedBounds.contains(bounds)) {
      return;
    }

    console.log('Fetching collisions for bounds:', bounds);

    // Expand bounds by 50%
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

    fetchAllCollisions().then(data => {
      console.log('Fetched all collisions:', data);
    });
    
    fetchCollisionsInBounds({
      north: expandedBounds.getNorth(),
      south: expandedBounds.getSouth(),
      east: expandedBounds.getEast(),
      west: expandedBounds.getWest()
    }).then(data => {
      console.log('Fetched collisions:', data);
      setCollisions(data);
      setCachedBounds(expandedBounds);
    });
  }, [bounds, zoom]);

    return collisions && collisions.length > 0 ? (
    <LayerGroup>
        {collisions.map(c => (
          <Circle
            key={c.id}
            center={[c.lat, c.lon]}
            radius={4}
            pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 1, weight: 0 }}
          />
        ))}
    </LayerGroup>
  ) : null;
}
