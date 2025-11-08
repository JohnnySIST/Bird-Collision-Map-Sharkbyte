import { useState, useRef } from 'react';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Autocomplete from '@mui/material/Autocomplete';

export default function SearchCity({ onSearch }: { onSearch?: (lat: number, lon: number) => void }) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<{ label: string, lat: number, lon: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Search function
  const doSearch = async () => {
    if (!search.trim()) return;
    const url = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(search)}&format=json&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.length > 0 && onSearch) {
      onSearch(parseFloat(data[0].lat), parseFloat(data[0].lon));
    }
  };

  // Debounced fetch city suggestions
  const handleInputChange = (event: any, value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!value.trim()) {
        setOptions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const url = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(value)}&format=json&limit=5`;
      const res = await fetch(url);
      const data = await res.json();
      setOptions(
        (data || []).map((item: any) => ({
          label: item.display_name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon)
        }))
      );
      setLoading(false);
    }, 500);
  };

  return (
    <Box sx={{ position: 'absolute', top: 10, left: 60, zIndex: 1000, background: 'rgba(255,255,255,0.95)', p: 1.5, borderRadius: 2, boxShadow: 2, display: 'flex', alignItems: 'center' }}>
      <Autocomplete
        freeSolo
        options={options}
        loading={loading}
        inputValue={search}
        onInputChange={handleInputChange}
        sx={{ width: 250, bgcolor: 'white', mr: 2 }}
        onChange={(_, value) => {
          if (value && typeof value === 'object' && 'lat' in value && 'lon' in value) {
            setSearch(value.label);
            if (onSearch) {
              onSearch(value.lat, value.lon);
            }
          }
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            variant="outlined"
            size="small"
            placeholder="Search city..."
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                doSearch();
              }
            }}
          />
        )}
      />
      <Button
        type="button"
        variant="contained"
        color="primary"
        sx={{ height: 40, fontWeight: 600, fontSize: 16, boxShadow: 2, textTransform: 'none' }}
        onClick={doSearch}
      >
        Search
      </Button>
    </Box>
  );
}