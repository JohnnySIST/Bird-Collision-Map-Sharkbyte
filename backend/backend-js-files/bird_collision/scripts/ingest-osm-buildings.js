const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * OpenStreetMap Overpass API
 * FREE - No API key needed!
 * Query building data worldwide
 * https://overpass-api.de/
 */
const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

/**
 * Calculate distance between two points (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Calculate bearing between two points
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Get buildings near a location using Overpass API
 */
async function getBuildingsNearLocation(lat, lon, radiusMeters = 200) {
  try {
    // Overpass QL query to get buildings within radius
    const query = `
      [out:json][timeout:25];
      (
        way["building"](around:${radiusMeters},${lat},${lon});
        relation["building"](around:${radiusMeters},${lat},${lon});
      );
      out center tags;
    `;
    
    const response = await axios.post(
      OVERPASS_API,
      query,
      {
        headers: {
          'Content-Type': 'text/plain'
        },
        timeout: 30000
      }
    );
    
    return response.data.elements || [];
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error('  Timeout - too many buildings in area');
    } else if (error.response && error.response.status === 429) {
      console.error('  Rate limited - waiting 60 seconds...');
      await new Promise(resolve => setTimeout(resolve, 60000));
      return getBuildingsNearLocation(lat, lon, radiusMeters);
    } else {
      console.error(`  Error: ${error.message}`);
    }
    return [];
  }
}

/**
 * Parse building data from OSM element
 */
function parseBuildingData(element) {
  const tags = element.tags || {};
  
  // Get center coordinates
  let lat, lon;
  if (element.center) {
    lat = element.center.lat;
    lon = element.center.lon;
  } else if (element.lat && element.lon) {
    lat = element.lat;
    lon = element.lon;
  } else {
    return null;
  }
  
  // Parse height
  let height = null;
  if (tags.height) {
    height = parseFloat(tags.height.replace(/[^0-9.]/g, ''));
  } else if (tags['building:levels']) {
    // Estimate: 3 meters per level
    height = parseInt(tags['building:levels']) * 3;
  }
  
  return {
    osm_id: element.id,
    latitude: lat,
    longitude: lon,
    building_type: tags.building || 'yes',
    height_m: height,
    levels: tags['building:levels'] ? parseInt(tags['building:levels']) : null,
    name: tags.name || null,
    address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']]
      .filter(Boolean).join(', ') || null,
    area_sqm: null, // Would need geometry calculation
    geometry: element.geometry ? { type: element.type, coordinates: element.geometry } : null,
    metadata: {
      amenity: tags.amenity,
      shop: tags.shop,
      office: tags.office,
      material: tags['building:material'],
      roof_material: tags['roof:material'],
      roof_shape: tags['roof:shape'],
      windows: tags.windows,
      glazing: tags['building:glazing']
    }
  };
}

/**
 * Main ingestion process
 */
async function ingestBuildingData() {
  console.log('=== OpenStreetMap Building Data Ingestion ===\n');
  console.log('✓ Using FREE Overpass API');
  console.log('✓ Worldwide building data');
  console.log('✓ No API key required\n');
  
  console.log('Fetching collisions...');
  const { data: collisions, error } = await supabase
    .from('collision_incidents')
    .select('id, latitude, longitude, date_time')
    .order('date_time', { ascending: false })
    .limit(100); // Start with 100 to avoid rate limits
  
  if (error) {
    console.error('Error fetching collisions:', error);
    return;
  }
  
  console.log(`Found ${collisions.length} collisions\n`);
  
  let processed = 0;
  let buildingsFound = 0;
  let proximityLinksCreated = 0;
  let errors = 0;
  
  // Track processed buildings to avoid duplicates
  const processedOsmIds = new Set();
  
  for (const collision of collisions) {
    try {
      console.log(`\n[${processed + 1}/${collisions.length}] Collision ID: ${collision.id}`);
      console.log(`  Location: (${collision.latitude.toFixed(4)}, ${collision.longitude.toFixed(4)})`);
      console.log(`  Date: ${collision.date_time.split('T')[0]}`);
      
      // Get buildings within 200m
      console.log(`  Fetching buildings within 200m...`);
      const buildings = await getBuildingsNearLocation(
        collision.latitude,
        collision.longitude,
        200
      );
      
      if (buildings.length > 0) {
        console.log(`  ✓ Found ${buildings.length} buildings nearby`);
        
        let newBuildings = 0;
        let linkedBuildings = 0;
        
        for (const building of buildings) {
          const buildingData = parseBuildingData(building);
          
          if (!buildingData) continue;
          
          // Calculate distance and bearing
          const distance = calculateDistance(
            collision.latitude,
            collision.longitude,
            buildingData.latitude,
            buildingData.longitude
          );
          
          const bearing = calculateBearing(
            collision.latitude,
            collision.longitude,
            buildingData.latitude,
            buildingData.longitude
          );
          
          // Only store building if we haven't seen it before
          if (!processedOsmIds.has(buildingData.osm_id)) {
            const { data: insertedBuilding, error: buildingError } = await supabase
              .from('buildings')
              .upsert(buildingData, {
                onConflict: 'osm_id',
                ignoreDuplicates: true
              })
              .select('id')
              .single();
            
            if (!buildingError && insertedBuilding) {
              processedOsmIds.add(buildingData.osm_id);
              newBuildings++;
              buildingsFound++;
              
              // Create proximity link
              const { error: proximityError } = await supabase
                .from('collision_building_proximity')
                .upsert({
                  collision_id: collision.id,
                  building_id: insertedBuilding.id,
                  distance_m: distance.toFixed(2),
                  direction_degrees: bearing.toFixed(1)
                }, {
                  onConflict: 'collision_id,building_id',
                  ignoreDuplicates: true
                });
              
              if (!proximityError) {
                linkedBuildings++;
                proximityLinksCreated++;
              }
            }
          } else {
            // Building already in DB, just create proximity link
            const { data: existingBuilding } = await supabase
              .from('buildings')
              .select('id')
              .eq('osm_id', buildingData.osm_id)
              .single();
            
            if (existingBuilding) {
              const { error: proximityError } = await supabase
                .from('collision_building_proximity')
                .upsert({
                  collision_id: collision.id,
                  building_id: existingBuilding.id,
                  distance_m: distance.toFixed(2),
                  direction_degrees: bearing.toFixed(1)
                }, {
                  onConflict: 'collision_id,building_id',
                  ignoreDuplicates: true
                });
              
              if (!proximityError) {
                linkedBuildings++;
                proximityLinksCreated++;
              }
            }
          }
        }
        
        console.log(`  ✓ Stored ${newBuildings} new buildings`);
        console.log(`  ✓ Created ${linkedBuildings} proximity links`);
      } else {
        console.log(`  - No buildings found nearby`);
      }
      
      processed++;
      
      // Overpass API rate limit: be conservative
      // Wait 2 seconds between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
      errors++;
    }
  }
  
  console.log(`\n\n=== Ingestion Complete ===`);
  console.log(`Collisions processed: ${processed}`);
  console.log(`Unique buildings found: ${buildingsFound}`);
  console.log(`Proximity links created: ${proximityLinksCreated}`);
  console.log(`Errors: ${errors}`);
  console.log(`\n✓ Building data is now linked to your collisions!`);
  console.log(`\n📊 Your frontend can now analyze:`);
  console.log(`  - Which buildings are near collision hotspots`);
  console.log(`  - Building heights and collision correlation`);
  console.log(`  - Distance from buildings to collision sites`);
  console.log(`  - Building types most associated with collisions`);
  console.log(`\n💡 Example queries:`);
  console.log(`  - "Show all collisions within 50m of tall buildings (>20m)"`);
  console.log(`  - "What % of collisions occur near glass office buildings?"`);
  console.log(`  - "Map view: collision sites with nearby buildings highlighted"`);
}

ingestBuildingData().catch(console.error);
