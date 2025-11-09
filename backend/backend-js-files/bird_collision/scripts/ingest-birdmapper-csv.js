const fs = require('fs');
const Papa = require('papaparse');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function ingestBirdMapperCSV() {
  console.log('Reading BirdMapper CSV...');
  
  // Read the CSV file
  const csvFile = fs.readFileSync('collision_incidents.csv', 'utf8');
  
  const results = Papa.parse(csvFile, {
    header: true,
    skipEmptyLines: true
  });

  console.log(`Found ${results.data.length} records in CSV`);
  
  let totalIngested = 0;
  let skipped = 0;
  let batch = [];
  
  for (const row of results.data) {
    // Parse coordinates
    const longitude = parseFloat(row.lng || row.x);
    const latitude = parseFloat(row.lat || row.y);
    
    // Skip records without valid coordinates
    if (isNaN(longitude) || isNaN(latitude)) {
      skipped++;
      continue;
    }
    
    // Parse date - BirdMapper format: "1/7/23, 7:00 AM"
    let dateTime = row.date || row.dateUTC || new Date().toISOString();
    if (dateTime && !dateTime.includes('T')) {
      // Convert "1/7/23" to ISO format
      try {
        const parts = dateTime.split(',')[0].split('/');
        if (parts.length === 3) {
          const month = parts[0].padStart(2, '0');
          const day = parts[1].padStart(2, '0');
          const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
          dateTime = `${year}-${month}-${day}T12:00:00Z`;
        }
      } catch (e) {
        dateTime = new Date().toISOString();
      }
    }
    
    const record = {
      longitude,
      latitude,
      species_name: row.species || 'Unknown',
      date_time: dateTime,
      source: 'birdmapper',
      source_id: `bm-${row.objectid || row.GlobalID || `${latitude}-${longitude}`}`,
      metadata: {
        status: row.status,
        side: row.side,
        notes: row.notes,
        location: row.location,
        collision_time: row.collision_time,
        alive: parseInt(row.Alive || 0),
        dead: parseInt(row.Dead || 0),
        total_birds: parseInt(row['Total Birds'] || 1),
        groupname: row.groupname,
        username: row.username,
        alpha_code: row.alpha_code,
        obs_type: row.obs_type
      }
    };
    
    batch.push(record);
    
    // Insert in batches of 50 (smaller batches for Supabase)
    if (batch.length >= 50) {
      const { error } = await supabase
        .from('collision_incidents')
        .upsert(batch, {
          onConflict: 'source,source_id',
          ignoreDuplicates: true
        });
      
      if (!error) {
        totalIngested += batch.length;
        console.log(`✓ Inserted batch: ${totalIngested} total ingested, ${skipped} skipped`);
      } else {
        console.error('Error:', error.message);
      }
      
      batch = [];
    }
  }
  
  // Insert remaining records
  if (batch.length > 0) {
    const { error } = await supabase
      .from('collision_incidents')
      .upsert(batch, {
        onConflict: 'source,source_id',
        ignoreDuplicates: true
      });
    
    if (!error) {
      totalIngested += batch.length;
    }
  }
  
  console.log(`\n✅ Finished!`);
  console.log(`   Total records ingested: ${totalIngested}`);
  console.log(`   Skipped (no coordinates): ${skipped}`);
  console.log(`   Total in CSV: ${results.data.length}`);
  
  process.exit(0);
}

ingestBirdMapperCSV().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
