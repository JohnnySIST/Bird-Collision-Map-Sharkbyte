const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * ALTERNATIVE APPROACH: Use NOAA's Earth Observation Group
 * Direct file access, no API authentication needed
 * https://eogdata.mines.edu/products/vnl/
 */

const EOG_BASE = 'https://eogdata.mines.edu/nighttime_light/annual/v21';

// Available annual composites
const YEARS = {
  2023: `${EOG_BASE}/2023/VNL_v21_npp_2023_global_vcmslcfg_c202402062300.average_masked.dat.tif.gz`,
  2024: `${EOG_BASE}/2024/VNL_v21_npp_2024_global_vcmslcfg_c202410311200.average_masked.dat.tif.gz`
};

/**
 * For now, just mark that VIIRS data exists for these locations
 * Actual brightness extraction requires downloading the GeoTIFF files
 */
async function markVIIRSAvailability() {
  console.log('=== VIIRS Data Availability Marking ===\n');
  console.log('This script marks which collisions have VIIRS data available.');
  console.log('Actual brightness extraction requires manual download of GeoTIFF files.\n');
  
  const { data: collisions, error } = await supabase
    .from('collision_incidents')
    .select('id, latitude, longitude, date_time')
    .order('date_time', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Found ${collisions.length} collisions\n`);
  
  let processed = 0;
  let marked = 0;
  
  for (const collision of collisions) {
    try {
      const date = new Date(collision.date_time);
      const year = date.getFullYear();
      
      // Check if we have VIIRS data for this year
      if (YEARS[year]) {
        const tile = {
          h: Math.floor((collision.longitude + 180) / 10),
          v: Math.floor((90 - collision.latitude) / 10)
        };
        
        const { error: insertError } = await supabase
          .from('viirs_nightlights')
          .upsert({
            collision_id: collision.id,
            latitude: collision.latitude,
            longitude: collision.longitude,
            date: collision.date_time.split('T')[0],
            brightness_avg: null,
            brightness_quality: 'data_available_pending_download',
            product: `VNL_v21_${year}`,
            tile_h: tile.h,
            tile_v: tile.v,
            metadata: {
              download_url: YEARS[year],
              note: 'Annual composite - requires GeoTIFF download and processing',
              year: year
            }
          }, {
            onConflict: 'collision_id,date,product',
            ignoreDuplicates: true
          });
        
        if (!insertError) {
          marked++;
        }
      }
      
      processed++;
      if (processed % 1000 === 0) {
        console.log(`Processed ${processed}/${collisions.length}...`);
      }
      
    } catch (error) {
      console.error(`Error processing collision ${collision.id}:`, error.message);
    }
  }
  
  console.log(`\n=== Complete ===`);
  console.log(`Processed: ${processed}`);
  console.log(`Marked: ${marked}`);
  console.log(`\n📥 Next Steps:`);
  console.log(`\n1. Download VIIRS GeoTIFF files manually:`);
  console.log(`   2023: ${YEARS[2023]}`);
  console.log(`   2024: ${YEARS[2024]}`);
  console.log(`\n2. Extract brightness values using GDAL or Python`);
  console.log(`\n3. Update database with actual brightness values`);
  console.log(`\nNote: Each file is ~1-2 GB compressed, ~5-6 GB uncompressed.`);
}

markVIIRSAvailability().catch(console.error);
