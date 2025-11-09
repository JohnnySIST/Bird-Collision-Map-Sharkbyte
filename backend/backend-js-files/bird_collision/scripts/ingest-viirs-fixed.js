const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const dns = require('dns');
require('dotenv').config({ path: '.env.local' });

// Force IPv4 for Node.js DNS resolution
dns.setDefaultResultOrder('ipv4first');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const NASA_TOKEN = 'eyJ0eXAiOiJKV1QiLCJvcmlnaW4iOiJFYXJ0aGRhdGEgTG9naW4iLCJzaWciOiJlZGxqd3RwdWJrZXlfb3BzIiwiYWxnIjoiUlMyNTYifQ.eyJ0eXBlIjoiVXNlciIsInVpZCI6ImJpcmRzZmx5aW5nIiwiZXhwIjoxNzY3ODMxOTE0LCJpYXQiOjE3NjI2NDc5MTQsImlzcyI6Imh0dHBzOi8vdXJzLmVhcnRoZGF0YS5uYXNhLmdvdiIsImlkZW50aXR5X3Byb3ZpZGVyIjoiZWRsX29wcyIsImFjciI6ImVkbCIsImFzc3VyYW5jZV9sZXZlbCI6M30.TDfr_HoOiXrTJz3Q1FlkyfDAjH-jGMl2hTIeHva8DCi4UDT-S0xNgwNvgk0pL1baTG08e5FYn0a6QkE6T7JrfRE-K1PSg6xauLZHeLYpjPj__Qzp3V0jAKp2gnCBIQYqyjrOltlSm8-IiyhjCi888NswIspQ7uG3_lgWSKc-82rIbV5WXAz7IIZ7bLyJc8nmyK9HfkP4wJCIS9qamhi3E306GcyZUI1doTw-9QNMxXey_-0ijGPZEJ0QYvDVRtO0HKTKJ6tzitVYouNJ4x8UoEv5_ErOlqFGoiiZB2t48bCPhQUL3V8IsWd-pW2ebUZAuIECy7Z66In1Tl14ikcM7Q';

// NASA CMR API
const CMR_API = 'https://cmr.earthdata.nasa.gov/search/granules.json';

// Create axios instance with better config
const axiosInstance = axios.create({
  timeout: 60000, // 60 second timeout
  family: 4 // Force IPv4
});

/**
 * Convert lat/lon to VIIRS tile (h,v)
 */
function latLonToVIIRSTile(lat, lon) {
  const h = Math.floor((lon + 180) / 10);
  const v = Math.floor((90 - lat) / 10);
  return { h, v };
}

/**
 * Search NASA CMR for VIIRS Black Marble data
 */
async function searchVIIRSGranules(lat, lon, date) {
  try {
    const tile = latLonToVIIRSTile(lat, lon);
    const dateObj = new Date(date);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    
    const params = {
      short_name: 'VNP46A3',
      version: '001',
      temporal: `${year}-${month}-01T00:00:00Z,${year}-${month}-28T23:59:59Z`,
      bounding_box: `${lon-1},${lat-1},${lon+1},${lat+1}`,
      page_size: 10
    };
    
    console.log(`  Searching for tile h${tile.h}v${tile.v}, ${year}-${month}`);
    
    const response = await axiosInstance.get(CMR_API, {
      params,
      headers: {
        'Authorization': `Bearer ${NASA_TOKEN}`
      }
    });
    
    if (response.data && response.data.feed && response.data.feed.entry) {
      return response.data.feed.entry;
    }
    
    return [];
  } catch (error) {
    if (error.response) {
      console.error(`  NASA API Error: ${error.response.status}`);
    } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      console.error(`  Connection timeout - retrying...`);
      // Retry once
      await new Promise(resolve => setTimeout(resolve, 2000));
      return searchVIIRSGranules(lat, lon, date);
    } else {
      console.error(`  Error: ${error.message}`);
    }
    return [];
  }
}

/**
 * Estimate brightness from granule metadata
 */
function estimateBrightness(granule) {
  return {
    brightness_avg: null,
    brightness_quality: 'data_available',
    product: 'VNP46A3',
    granule_id: granule.id,
    download_url: granule.links?.find(l => l.rel === 'http://esipfed.org/ns/fedsearch/1.1/data#')?.href
  };
}

/**
 * Main ingestion process
 */
async function ingestVIIRS() {
  console.log('=== VIIRS Nighttime Lights Ingestion ===\n');
  
  console.log('Fetching collisions...');
  const { data: collisions, error } = await supabase
    .from('collision_incidents')
    .select('id, latitude, longitude, date_time')
    .order('date_time', { ascending: false })
    .limit(100);
  
  if (error) {
    console.error('Error fetching collisions:', error);
    return;
  }
  
  console.log(`Found ${collisions.length} collisions\n`);
  
  let processed = 0;
  let dataFound = 0;
  let errors = 0;
  
  for (const collision of collisions) {
    try {
      // FIX: collision.id is INTEGER, not UUID string
      console.log(`\n[${processed + 1}/${collisions.length}] Collision ID: ${collision.id}`);
      console.log(`  Location: (${collision.latitude.toFixed(4)}, ${collision.longitude.toFixed(4)})`);
      console.log(`  Date: ${collision.date_time.split('T')[0]}`);
      
      const granules = await searchVIIRSGranules(
        collision.latitude,
        collision.longitude,
        collision.date_time
      );
      
      if (granules.length > 0) {
        console.log(`  ✓ Found ${granules.length} VIIRS granule(s)`);
        
        const brightnessData = estimateBrightness(granules[0]);
        const tile = latLonToVIIRSTile(collision.latitude, collision.longitude);
        
        const { error: insertError } = await supabase
          .from('viirs_nightlights')
          .upsert({
            collision_id: collision.id,
            latitude: collision.latitude,
            longitude: collision.longitude,
            date: collision.date_time.split('T')[0],
            brightness_avg: brightnessData.brightness_avg,
            brightness_quality: brightnessData.brightness_quality,
            product: brightnessData.product,
            tile_h: tile.h,
            tile_v: tile.v,
            metadata: {
              granule_id: brightnessData.granule_id,
              download_url: brightnessData.download_url,
              search_date: new Date().toISOString()
            }
          }, {
            onConflict: 'collision_id,date,product',
            ignoreDuplicates: true
          });
        
        if (!insertError) {
          dataFound++;
          console.log(`  ✓ Stored VIIRS reference`);
        } else {
          console.error(`  ✗ Storage error: ${insertError.message}`);
          errors++;
        }
      } else {
        console.log(`  - No VIIRS data found`);
      }
      
      processed++;
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 800));
      
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
      errors++;
    }
  }
  
  console.log(`\n\n=== Ingestion Complete ===`);
  console.log(`Processed: ${processed}`);
  console.log(`Data Found: ${dataFound}`);
  console.log(`Errors: ${errors}`);
  console.log(`\n📝 Note: Currently storing VIIRS file references.`);
  console.log(`Run Python script next to extract brightness values.`);
}

ingestVIIRS().catch(console.error);