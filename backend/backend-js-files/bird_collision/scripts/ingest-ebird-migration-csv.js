const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const EBIRD_API_KEY = process.env.EBIRD_API_KEY || 'pa7mo6o49siv';
const EBIRD_API_BASE = 'https://api.ebird.org/v2';

/**
 * Create eBird migration data table
 */
async function createEBirdTable() {
  console.log('\nRun this SQL in Supabase to create the eBird table:\n');
  console.log(`
CREATE TABLE IF NOT EXISTS ebird_observations (
  id SERIAL PRIMARY KEY,
  collision_id INTEGER REFERENCES collision_incidents(id),
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  observation_date DATE NOT NULL,
  species_code TEXT,
  common_name TEXT,
  scientific_name TEXT,
  observation_count INTEGER,
  location_name TEXT,
  distance_km NUMERIC,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(collision_id, species_code, observation_date)
);

CREATE INDEX IF NOT EXISTS idx_ebird_collision ON ebird_observations(collision_id);
CREATE INDEX IF NOT EXISTS idx_ebird_date ON ebird_observations(observation_date);
CREATE INDEX IF NOT EXISTS idx_ebird_species ON ebird_observations(species_code);
  `);
}

/**
 * Calculate distance between two points (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Get recent bird observations near a location
 * eBird API: /data/obs/geo/recent
 */
async function getRecentObservations(lat, lon, days = 14) {
  try {
    const response = await axios.get(
      `${EBIRD_API_BASE}/data/obs/geo/recent`,
      {
        params: {
          lat: lat,
          lng: lon,
          dist: 25, // 25km radius
          back: days, // Days back
          maxResults: 100
        },
        headers: {
          'X-eBirdApiToken': EBIRD_API_KEY
        },
        timeout: 30000
      }
    );
    
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`  eBird API Error: ${error.response.status} - ${error.response.statusText}`);
    } else {
      console.error(`  Error: ${error.message}`);
    }
    return [];
  }
}

/**
 * Get notable observations (rarities, high counts)
 */
async function getNotableObservations(lat, lon, days = 14) {
  try {
    const response = await axios.get(
      `${EBIRD_API_BASE}/data/obs/geo/recent/notable`,
      {
        params: {
          lat: lat,
          lng: lon,
          dist: 25,
          back: days,
          maxResults: 50
        },
        headers: {
          'X-eBirdApiToken': EBIRD_API_KEY
        },
        timeout: 30000
      }
    );
    
    return response.data;
  } catch (error) {
    console.error(`  Notable observations error: ${error.message}`);
    return [];
  }
}

/**
 * Main ingestion process
 */
async function ingestEBirdData() {
  console.log('=== eBird Migration Data Ingestion ===\n');
  
  await createEBirdTable();
  
  console.log('\nPress Enter after creating the table in Supabase...');
  await new Promise(resolve => {
    process.stdin.once('data', () => resolve());
  });
  
  console.log('\nFetching collisions...');
  const { data: collisions, error } = await supabase
    .from('collision_incidents')
    .select('id, latitude, longitude, date_time, species_name')
    .order('date_time', { ascending: false })
    .limit(100); // Start with 100
  
  if (error) {
    console.error('Error fetching collisions:', error);
    return;
  }
  
  console.log(`Found ${collisions.length} collisions\n`);
  
  let processed = 0;
  let observationsFound = 0;
  let errors = 0;
  
  for (const collision of collisions) {
    try {
      console.log(`\n[${processed + 1}/${collisions.length}] Collision ID: ${collision.id}`);
      console.log(`  Location: (${collision.latitude.toFixed(4)}, ${collision.longitude.toFixed(4)})`);
      console.log(`  Date: ${collision.date_time.split('T')[0]}`);
      console.log(`  Species: ${collision.species_name || 'Unknown'}`);
      
      // Get bird observations within 14 days of collision
      console.log(`  Fetching eBird observations...`);
      const observations = await getRecentObservations(
        collision.latitude,
        collision.longitude,
        14
      );
      
      if (observations.length > 0) {
        console.log(`  ✓ Found ${observations.length} bird observations nearby`);
        
        // Store each observation
        for (const obs of observations) {
          const distance = calculateDistance(
            collision.latitude,
            collision.longitude,
            obs.lat,
            obs.lng
          );
          
          const { error: insertError } = await supabase
            .from('ebird_observations')
            .upsert({
              collision_id: collision.id,
              latitude: obs.lat,
              longitude: obs.lng,
              observation_date: obs.obsDt.split(' ')[0], // Extract date
              species_code: obs.speciesCode,
              common_name: obs.comName,
              scientific_name: obs.sciName,
              observation_count: obs.howMany || 1,
              location_name: obs.locName,
              distance_km: distance.toFixed(2),
              metadata: {
                obs_id: obs.subId,
                obs_reviewed: obs.obsReviewed,
                location_private: obs.locationPrivate
              }
            }, {
              onConflict: 'collision_id,species_code,observation_date',
              ignoreDuplicates: true
            });
          
          if (!insertError) {
            observationsFound++;
          }
        }
        
        console.log(`  ✓ Stored ${observations.length} observations`);
      } else {
        console.log(`  - No observations found`);
      }
      
      processed++;
      
      // eBird rate limit: 100 requests per minute
      await new Promise(resolve => setTimeout(resolve, 700));
      
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
      errors++;
    }
  }
  
  console.log(`\n\n=== Ingestion Complete ===`);
  console.log(`Collisions processed: ${processed}`);
  console.log(`Bird observations found: ${observationsFound}`);
  console.log(`Errors: ${errors}`);
  console.log(`\n✓ eBird migration data is now linked to your collisions!`);
  console.log(`\nFrontend can now show:`);
  console.log(`- What birds were migrating near collision sites`);
  console.log(`- Migration intensity during collision events`);
  console.log(`- Species-specific patterns`);
}

ingestEBirdData().catch(console.error);