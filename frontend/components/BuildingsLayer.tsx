import { Marker, LayerGroup } from 'react-leaflet';
import { fetchCollisionsInBounds } from '../context/DataAPI';
import { GeoJSON } from 'react-leaflet';
import { useEffect, useState } from 'react';
import osmtogeojson from 'osmtogeojson';
import { useGlobalContext } from '../context/GlobalContext';
import L from 'leaflet';

export default function BuildingsLayer({ highlighted, setHighlighted }: { highlighted: number | null, setHighlighted: (id: number | null) => void }) {
  const [buildings, setBuildings] = useState<any>(null);
  const [cachedBounds, setCachedBounds] = useState<L.LatLngBounds | null>(null);
  const { bounds, zoom, collisions } = useGlobalContext();

  useEffect(() => {
    if (!bounds || !zoom || zoom <= 15) {
      setBuildings(null);
      setCachedBounds(null);
      return;
    }

    // If cachedBounds exists and current bounds is fully inside cachedBounds, use cachedBuildings
    if (cachedBounds && cachedBounds.contains(bounds)) {
      return;
    }

    // Expand bounds by 50% in each direction
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

    const south = expandedBounds.getSouth();
    const west = expandedBounds.getWest();
    const north = expandedBounds.getNorth();
    const east = expandedBounds.getEast();
    const query = `
      [out:json][timeout:25];
      (
        way["building"](${south},${west},${north},${east});
        relation["building"](${south},${west},${north},${east});
      );
      out;
      >;
      out skel qt;
    `;
    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then(osmData => {
        console.log('OSM Data:', osmData);
        const geojson = osmtogeojson(osmData);
        setBuildings(geojson);
        setCachedBounds(expandedBounds);
      });
  }, [bounds, zoom]);

  const highlightStyle = {
    color: '#ff0000',
    weight: 3,
    fillOpacity: 0.5
  };

  const defaultStyle = {
    color: '#ede397',
    weight: 1,
    fillOpacity: 0.7
  };

  // Color scale: shallow yellow to deep orange
  function getColorByCount(count: number, maxCount: number) {
    // 0: #fffde4, 1/4: #ffe08a, 1/2: #ffc04d, 3/4: #ff9800, max: #ff7800
    if (count === 0) return '#fffde4';
    const ratio = Math.min(count / maxCount, 1);
    if (ratio < 0.25) return '#ffe08a';
    if (ratio < 0.5) return '#ffc04d';
    if (ratio < 0.75) return '#ff9800';
    return '#ff7800';
  }

  // For each building, count collisions within 30m
  function getCollisionCount(feature: any) {
    if (!feature?.geometry?.type || !feature.geometry.coordinates) return 0;
    // Get all building coordinates (Polygon or MultiPolygon)
    let coords: number[][] = [];
    if (feature.geometry.type === 'Polygon') {
      coords = feature.geometry.coordinates[0];
    } else if (feature.geometry.type === 'MultiPolygon') {
      coords = feature.geometry.coordinates.flat(2);
    }
    // Use centroid for simplicity
    const centroid = coords.reduce((acc, cur) => [acc[0] + cur[0], acc[1] + cur[1]], [0, 0]).map(x => x / coords.length);
    // Convert [lon, lat] to [lat, lon]
    const [lon, lat] = centroid;
    // Count collisions within 30m
    return collisions.filter(c => {
      const d = L.latLng(lat, lon).distanceTo(L.latLng(c.lat, c.lon));
      return d < 30;
    }).length;
  }

  function onEachFeature(feature: any, layer: any) {
    layer.on({
      click: (e: any) => {
        e.originalEvent?.stopPropagation();
        if (highlighted == feature.id) {
          setHighlighted(null);
          return;
        }
        setHighlighted(feature.id);
      }
    });
  }

  function style(feature: any) {
    if (highlighted === feature.id) return highlightStyle;
    return defaultStyle;
    const count = getCollisionCount(feature);
    // Find max count for color scale
    const maxCount = buildings?.features?.length ? Math.max(...buildings.features.map(getCollisionCount)) : 1;
    return {
      color: getColorByCount(count, maxCount),
      weight: 1,
      fillOpacity: 0.7
    };
  }

  return buildings && (
    buildings && (
      <GeoJSON 
        key={buildings?.features?.length}
        data={buildings} 
        style={style} 
        onEachFeature={onEachFeature} 
      />
    )
  );
}
