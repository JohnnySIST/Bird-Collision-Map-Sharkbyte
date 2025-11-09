import { useMap } from 'react-leaflet';
import { useEffect } from 'react';
import { useGlobalContext } from '../context/GlobalContext';

export default function BoundMonitor() {
  const map = useMap();
  const { setBounds, setZoom, setMapCenter } = useGlobalContext();
  useEffect(() => {
    const updateContext = () => {
      setBounds(map.getBounds());
      setZoom(map.getZoom());
      setMapCenter(map.getCenter());
      console.log("zoom:", map.getZoom());
      console.log("bounds:", map.getBounds());
    };
    updateContext();
    map.on('moveend', updateContext);
    map.on('zoomend', updateContext);
    return () => {
      map.off('moveend', updateContext);
      map.off('zoomend', updateContext);
    };
  }, [map, setBounds, setZoom]);
  return null;
}
