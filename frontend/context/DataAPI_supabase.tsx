import { createClient } from '@supabase/supabase-js';

const API_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const API_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY || '';

const supabase = createClient(
  API_URL,
  API_KEY
);

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

export async function fetchAllEbird(): Promise<CollisionRecord[]> {
  const { data, error } = await supabase
    .from('ebird_observations')
    .select('*')
  if (error) throw error;
  console.log('Fetched all ebird:', data);
  return (data || [])
    .map((item: any) => ({
      id: item.id,
      time: item.metadata.taxon.created_at,
      lat: item.latitude,
      lon: item.longitude,
      scientific_name: item.species_name,
      common_name: item.common_name,
      image_url: item.metadata.taxon.default_photo.url,
      url: item.url,
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
      time: item.metadata.taxon.created_at,
      lat: item.latitude,
      lon: item.longitude,
      scientific_name: item.species_name,
      common_name: item.common_name,
      image_url: item.metadata.taxon.default_photo.url,
      url: item.url,
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
      time: item.metadata?.taxon?.created_at,
      lat: item.latitude,
      lon: item.longitude,
      scientific_name: item.species_name,
      common_name: item.common_name,
      image_url: item.metadata?.taxon?.default_photo?.url,
      url: item.url,
    }));
}

// Example: fetch collisions within bounds
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
      time: item.metadata?.taxon?.created_at,
      lat: item.latitude,
      lon: item.longitude,
      scientific_name: item.species_name,
      common_name: item.common_name,
      image_url: item.metadata?.taxon?.default_photo?.url,
      url: item.url,
    }))
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}
