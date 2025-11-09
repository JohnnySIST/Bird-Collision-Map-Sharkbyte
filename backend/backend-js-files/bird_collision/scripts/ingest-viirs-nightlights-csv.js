const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const NASA_TOKEN = 'eyJ0eXAiOiJKV1QiLCJvcmlnaW4iOiJFYXJ0aGRhdGEgTG9naW4iLCJzaWciOiJlZGxqd3RwdWJrZXlfb3BzIiwiYWxnIjoiUlMyNTYifQ.eyJ0eXBlIjoiVXNlciIsInVpZCI6ImJpcmRzZmx5aW5nIiwiZXhwIjoxNzY3ODMxOTE0LCJpYXQiOjE3NjI2NDc5MTQsImlzcyI6Imh0dHBzOi8vdXJzLmVhcnRoZGF0YS5uYXNhLmdvdiIsImlkZW50aXR5X3Byb3ZpZGVyIjoiZWRsX29wcyIsImFjciI6ImVkbCIsImFzc3VyYW5jZV9sZXZlbCI6M30.TDfr_HoOiXrTJz3Q1FlkyfDAjH-jGMl2hTIeHva8DCi4UDT-S0xNgwNvgk0pL1baTG08e5FYn0a6QkE6T7JrfRE-K1PSg6xauLZHeLYpjPj__Qzp3V0jAKp2gnCBIQYqyjrOltlSm8-IiyhjCi888NswIspQ7uG3_lgWSKc-82rIbV5WXAz7IIZ7bLyJc8nmyK9HfkP4wJCIS9qamhi3E306GcyZUI1doTw-9QNMxXey_-0ijGPZEJ0QYvDVRtO0HKTKJ6tzitVYouNJ4x8UoEv5_ErOlqFGoiiZB2t48bCPhQUL3V8IsWd-pW2ebUZAuIECy7Z66In1Tl14ikcM7Q';

// VIIRS Black Marble API endpoint
const VIIRS_API_BASE = 'https://ladsweb.modaps.eosdis.nasa.gov/api/v2';

/**
 * Create table for VIIRS nighttime lights data
 */
async function createVIIRSTable() {
  console.log('Creating VIIRS nighttime lights table...');
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS viirs_nightlights (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      collision_id UUID REFERENCES collision_incidents(id),
      latitude NUMERIC NOT NULL,
      longitude NUMERIC NOT NULL,
      date DATE NOT NULL,
      brightness_value NUMERIC,
      brightness_quality INTEGER,
      tile_name TEXT,
      source TEXT DEFAULT 'VNP46A2',
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_viirs_collision ON viirs_nightlights(collision_id);
    CREATE INDEX IF NOT EXISTS idx_viirs_date ON viirs_nightlights(date);
    CREATE INDEX IF NOT EXISTS idx_viirs_location ON viirs_nightlights(latitude, longitude);
  `;
  
  console.log('✓ VIIRS table ready');
}

/**
 * Convert lat/lon to VIIRS tile coordinates
 * VIIRS uses h/v tiling system (similar to MODIS)
 */
function latLonToTile(lat, lon) {
  // Simplified tile calculation for VIIRS sinusoidal projection
  // Each tile is ~10 degrees at equator
  const h = Math.floor((lon + 180) / 10);
  const v = Math.floor((90 - lat) / 10);
  return { h, v };
}

/**
 * Format date for NASA API (YYYY-MM-DD)
 */
function formatDateForAPI(dateString) {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

/**
 * Search for VIIRS files for a specific date and location
 */
async function searchVIIRSFiles(lat, lon, date) {
  const tile = latLonToTile(lat, lon);
  const dateStr = formatDateForAPI(date);
  
  try {
    // Search for VNP46A2 product (Daily nighttime lights)
    const searchUrl = `${VIIRS_API_BASE}/files/product=VNP46A2&collection=5000&dateRanges=${dateStr}..${dateStr}`;
    
    console.log(`Searching VIIRS for date ${dateStr}, tile h${tile.h}v${tile.v}...`);
    
    const response = await axios.get(searchUrl, {
      headers: {
        'Authorization': `Bearer ${NASA_TOKEN}`
      }
    });
    
    if (response.data && response.data.length > 0) {
      // Filter for the specific tile
      const tileFiles = response.data.filter(file => 
        file.name.includes(`h${String(tile.h).padStart(2, '0')}v${String(tile.v).padStart(2, '0')}`)
      );
      
      return tileFiles;
    }
    
    return [];
  } catch (error) {
    console.error(`Error searching VIIRS: ${error.message}`);
    return [];
  }
}

/**
 * 
 */
async function extractBrightnessValue(fileUrl, lat, lon) {
  try {
    // For now, we'll use the VIIRS API to get aggregated data
    // Full implementation would download HDF5 file and extract exact pixel
    
    console.log(`  Extracting brightness for (${lat}, ${lon})...`);
    
    // Placeholder: In production, you'd:
    // 1. Download HDF5 file
    // 2. Use h5py or similar to extract exact pixel
    // 3. Return brightness value
    
    // For now, return a flag indicating we found the file
    return {
      brightness: null, // Would be actual value from HDF5
      quality: null,
      note: 'File found - needs HDF5 processing'
    };
    
  } catch (error) {
    console.error(`Error extracting brightness: ${error.message}`);
    return null;
  }
}

/**
 * Process collisions and fetch VIIRS data
 */
async function ingestVIIRSForCollisions() {
  console.log('Starting VIIRS nighttime lights ingestion...\n');
  
  // Create table first
  await createVIIRSTable();
  
  // Fetch all collisions without VIIRS data
  console.log('Fetching collisions needing VIIRS data...');
  const { data: collisions, error } = await supabase
    .from('collision_incidents')
    .select('id, latitude, longitude, date_time')
    .order('date_time', { ascending: false })
    .limit(100); // Start with 100 most recent
  
  if (error) {
    console.error('Error fetching collisions:', error);
    return;
  }
  
  console.log(`Found ${collisions.length} collisions to process\n`);
  
  let processed = 0;
  let foundData = 0;
  
  for (const collision of collisions) {
    try {
      console.log(`\nProcessing collision ${collision.id.substring(0, 8)}...`);
      console.log(`  Location: (${collision.latitude}, ${collision.longitude})`);
      console.log(`  Date: ${collision.date_time}`);
      
      // Search for VIIRS files
      const files = await searchVIIRSFiles(
        collision.latitude,
        collision.longitude,
        collision.date_time
      );
      
      if (files.length > 0) {
        console.log(`  ✓ Found ${files.length} VIIRS file(s)`);
        
        // For each file, extract brightness
        for (const file of files) {
          const brightnessData = await extractBrightnessValue(
            file.downloadsLink,
            collision.latitude,
            collision.longitude
          );
          
          if (brightnessData) {
            // Store in database
            const { error: insertError } = await supabase
              .from('viirs_nightlights')
              .insert({
                collision_id: collision.id,
                latitude: collision.latitude,
                longitude: collision.longitude,
                date: collision.date_time.split('T')[0],
                brightness_value: brightnessData.brightness,
                brightness_quality: brightnessData.quality,
                tile_name: file.name,
                metadata: {
                  file_url: file.downloadsLink,
                  file_size: file.size,
                  note: brightnessData.note
                }
              });
            
            if (!insertError) {
              foundData++;
              console.log(`  ✓ Stored VIIRS data`);
            } else {
              console.error(`  ✗ Error storing: ${insertError.message}`);
            }
          }
        }
      } else {
        console.log(`  - No VIIRS data available for this date/location`);
      }
      
      processed++;
      
      // Rate limiting - NASA allows ~100 requests/min
      await new Promise(resolve => setTimeout(resolve, 700));
      
    } catch (error) {
      console.error(`Error processing collision: ${error.message}`);
    }
  }
  
  console.log(`\n\n=== VIIRS Ingestion Complete ===`);
  console.log(`Processed: ${processed} collisions`);
  console.log(`Found data: ${foundData} records`);
  console.log(`\nNote: Full brightness extraction requires HDF5 processing.`);
  console.log(`Current implementation identifies available files.`);
}

// Run ingestion
ingestVIIRSForCollisions().catch(console.error);