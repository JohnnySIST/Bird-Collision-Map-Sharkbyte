import { GeoJSON } from 'react-leaflet';
import { useEffect, useState } from 'react';
import osmtogeojson from 'osmtogeojson';
import { useGlobalContext } from '../context/GlobalContext';
import L from 'leaflet';

export default function BuildingsLayer({ highlighted, setHighlighted }: { highlighted: number | null, setHighlighted: (id: number | null) => void }) {
  const [buildings, setBuildings] = useState<any>(null);
  const [cachedBounds, setCachedBounds] = useState<L.LatLngBounds | null>(null);
  const { bounds, zoom } = useGlobalContext();

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
    color: '#ff7800',
    weight: 1,
    fillOpacity: 0.3
  };

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
    return highlighted === feature.id ? highlightStyle : defaultStyle;
  }

  return buildings && (
    <GeoJSON 
      key={buildings?.features?.length}
      data={buildings} 
      style={style} 
      onEachFeature={onEachFeature} 
    />
  );
}
