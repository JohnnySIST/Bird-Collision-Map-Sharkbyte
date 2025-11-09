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

  function onEachFeature(feature: any, layer: any) {
    layer.on({
      click: (e: any) => {
        e.originalEvent?.stopPropagation();
        if (highlighted == feature.id) {
          setHighlighted(null);
          layer.closePopup();
          return;
        }
        setHighlighted(feature.id);
        // Extract OSM tags
        const properties = feature?.properties || {};
        const name = properties.name || "Unknown";
        const city = properties["addr:city"] || "";
        const state = properties["addr:state"] || "";
        const postcode = properties["addr:postcode"] || "";
        const startDate = properties["start_date"] || "";
        const wikipedia = properties["wikipedia"] || "";
        let wikipediaLink = "";
        if (wikipedia) {
          // wikipedia tag format: "en:Barclay–Vesey Building"
          const parts = wikipedia.split(":");
          if (parts.length === 2) {
            wikipediaLink = `https://en.wikipedia.org/wiki/${encodeURIComponent(parts[1])}`;
          } else {
            wikipediaLink = `https://en.wikipedia.org/wiki/${encodeURIComponent(wikipedia)}`;
          }
        }
        // Merge city, state, postcode into one line, only if all present
        let locationLine = "";
        if (city && state && postcode) {
          locationLine = [city, state, postcode].join(", ");
        }
        // Name as Wikipedia link if available
        let nameHtml = `<strong>${name}</strong>`;
        if (wikipediaLink) {
          nameHtml = `<strong><a href='${wikipediaLink}' target='_blank' style='text-decoration:none;color:#0074d9;'>${name}</a></strong>`;
        }
        const infoHtml = `
          <div>
            ${nameHtml}<br/>
            ${locationLine ? locationLine + '<br/>' : ''}
            ${startDate ? `Built: ${startDate}<br/>` : ""}
          </div>
        `;
        layer.bindPopup(infoHtml).openPopup();
      }
    });
  }

  function style(feature: any) {
    if (highlighted === feature.id) return highlightStyle;
    return defaultStyle;
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
