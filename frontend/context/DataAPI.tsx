// DataAPI.tsx: Fetch collision data from backend
// You must set NEXT_PUBLIC_API_URL=http://localhost:3001 in .env.local

export interface CollisionRecord {
  id: number;
  time: string;
  lat: number;
  lon: number;
  scientific_name: string;
  common_name: string;
  image_url: string;
  url: string;
}

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Query collision records within the given bounds
export async function fetchCollisionsInBounds(bounds: Bounds): Promise<CollisionRecord[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) throw new Error('Please set NEXT_PUBLIC_API_URL in .env.local');
  // Build SQL query
  const sql = `SELECT id, observed_on_string as time, latitude as lat, longitude as lon, scientific_name, common_name, image_url, url FROM observations WHERE latitude BETWEEN ${bounds.south} AND ${bounds.north} AND longitude BETWEEN ${bounds.west} AND ${bounds.east}`;
  // console.log('Fetching collisions with SQL:', sql);
  const res = await fetch(`${apiUrl}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql })
  });
  if (!res.ok) throw new Error('Failed to fetch collision data');
  return await res.json();
}
