import { createClient } from '@supabase/supabase-js';

const API_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const API_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY || '';

const supabase = createClient(
  API_URL,
  API_KEY
);

export interface WeatherRecord {
  id: number;
  time: string;
  lat: number;
  lon: number;
  temperature: number;
  wind_speed: number;
  weather_code: number;
  weather_description: string;
}

export interface EbirdRecord {
  id: number;
  date: string;
  lat: number;
  lon: number;
  scientific_name: string;
  common_name: string;
}

export interface CollisionRecord {
  id: number;
  time: string;
  lat: number;
  lon: number;
  scientific_name: string;
  common_name: string;
  image_url: string;
  url: string;
  wiki_url: string;
}

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export async function fetchAllWeather(): Promise<WeatherRecord[]> {
  const { data, error } = await supabase
    .from('weather_conditions')
    .select('*')
  if (error) throw error;
  console.log('Fetched all weather data:', data);
  return (data || [])
    .map((item: any) => ({
      id: item.id,
      time: item.observation_time,
      lat: item.latitude,
      lon: item.longitude,
      temperature: item.temperature_c,
      wind_speed: item.wind_speed_kmh,
      weather_code: item.weather_code,
      weather_description: item.metadata?.weather_description,
    }));
}

// fetch weather within bounds
export async function fetchWeatherInBoundsSupabase(bounds: Bounds): Promise<WeatherRecord[]> {
  const { data, error } = await supabase
    .from('weather_conditions')
    .select('*')
    .gte('latitude', bounds.south)
    .lte('latitude', bounds.north)
    .gte('longitude', bounds.west)
    .lte('longitude', bounds.east);
  if (error) throw error;
  return (data || [])
    .map((item: any) => ({
      id: item.id,
      time: item.observation_time,
      lat: item.latitude,
      lon: item.longitude,
      temperature: item.temperature_c,
      wind_speed: item.wind_speed_kmh,
      weather_code: item.weather_code,
      weather_description: item.metadata?.weather_description,
    }));
}

export async function fetchAllEbird(): Promise<EbirdRecord[]> {
  const { data, error } = await supabase
    .from('ebird_observations')
    .select('*')
  if (error) throw error;
  console.log('Fetched all ebird:', data);
  return (data || [])
    .map((item: any) => ({
      id: item.id,
      date: item.observation_date,
      lat: item.latitude,
      lon: item.longitude,
      scientific_name: item.scientific_name,
      common_name: item.common_name,
    }));
}

// fetch ebird within bounds
export async function fetchEbirdInBoundsSupabase(bounds: Bounds): Promise<EbirdRecord[]> {
  const { data, error } = await supabase
    .from('ebird_observations')
    .select('*')
    .gte('latitude', bounds.south)
    .lte('latitude', bounds.north)
    .gte('longitude', bounds.west)
    .lte('longitude', bounds.east);
  if (error) throw error;
  return (data || [])
    .map((item: any) => ({
      id: item.id,
      date: item.observation_date,
      lat: item.latitude,
      lon: item.longitude,
      scientific_name: item.scientific_name,
      common_name: item.common_name,
    }));
}

export async function fetchAllHeight(): Promise<CollisionRecord[]> {
  const { data, error } = await supabase
    .from('collision_building_proximity')
    .select('*')
  if (error) throw error;
  console.log('Fetched all heights:', data);
  return (data || [])
    .map((item: any) => ({
      id: item.id,
      time: item.date_time,
      lat: item.latitude,
      lon: item.longitude,
      scientific_name: item.species_name,
      common_name: item.common_name,
      image_url: item.metadata?.taxon?.default_photo?.url,
      url: `https://www.inaturalist.org/observations/${item.source_id}`,
      wiki_url: item.metadata?.taxon?.wikipedia_url,
    }));
}

// Fetch all collisions
export async function fetchAllCollisions(): Promise<CollisionRecord[]> {
  const { data, error } = await supabase
    .from('collision_incidents')
    .select('*');
  if (error) throw error;
  console.log('Fetched all collisions:', data);
  return (data || [])
    .map((item: any) => ({
      id: item.id,
      time: item.date_time,
      lat: item.latitude,
      lon: item.longitude,
      scientific_name: item.species_name,
      common_name: item.common_name,
      image_url: item.metadata?.taxon?.default_photo?.url,
      url: `https://www.inaturalist.org/observations/${item.source_id}`,
      wiki_url: item.metadata?.taxon?.wikipedia_url,
    }));
}

// fetch collisions within bounds
export async function fetchCollisionsInBoundsSupabase(bounds: Bounds): Promise<CollisionRecord[]> {
  const { data, error } = await supabase
    .from('collision_incidents')
    .select('*')
    .gte('latitude', bounds.south)
    .lte('latitude', bounds.north)
    .gte('longitude', bounds.west)
    .lte('longitude', bounds.east);
  if (error) throw error;
  return (data || [])
    .map((item: any) => ({
      id: item.id,
      time: item.date_time,
      lat: item.latitude,
      lon: item.longitude,
      scientific_name: item.species_name,
      common_name: item.common_name,
      image_url: item.metadata?.taxon?.default_photo?.url,
      url: `https://www.inaturalist.org/observations/${item.source_id}`,
      wiki_url: item.metadata?.taxon?.wikipedia_url,
    }))
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}
