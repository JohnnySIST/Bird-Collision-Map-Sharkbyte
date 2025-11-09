const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function ingestINaturalist() {
  console.log('Starting iNaturalist ingestion...');
  
  let page = 1;
  let totalIngested = 0;
  const maxPages = 50;
  
  while (page <= maxPages) {
    try {
      console.log(`Fetching page ${page}...`);
      
      const response = await axios.get('https://api.inaturalist.org/v1/observations', {
        params: {
          project_id: 'bird-window-collisions',
          d1: '2023-01-01',
          per_page: 200,
          page: page,
          order_by: 'created_at',
          order: 'desc',
          quality_grade: 'any'
        }
      });

      const observations = response.data.results;
      
      if (!observations || observations.length === 0) {
        console.log('No more observations found.');
        break;
      }

      for (const obs of observations) {
        if (obs.location) {
          const [lat, lng] = obs.location.split(',').map(parseFloat);
          
          if (!isNaN(lat) && !isNaN(lng)) {
            const { error } = await supabase
              .from('collision_incidents')
              .upsert({
                longitude: lng,
                latitude: lat,
                species_name: obs.species_guess || 'Unknown',
                date_time: obs.observed_on || new Date().toISOString(),
                source: 'inaturalist',
                source_id: obs.id.toString(),
                metadata: {
                  taxon: obs.taxon,
                  quality_grade: obs.quality_grade,
                  user: obs.user?.login
                }
              }, {
                onConflict: 'source,source_id',
                ignoreDuplicates: true
              });
            
            if (!error) {
              totalIngested++;
            } else if (!error.message.includes('duplicate')) {
              console.error(`Error for observation ${obs.id}:`, error.message);
            }
          }
        }
      }

      console.log(`✓ Page ${page}: ${observations.length} records. Total: ${totalIngested}`);
      page++;
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Error on page ${page}:`, error.message);
      if (error.response?.status === 429) {
        console.log('Rate limited. Waiting 10 seconds...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      } else {
        break;
      }
    }
  }
  
  console.log(`\n✓ Finished! Total records ingested: ${totalIngested}`);
  process.exit(0);
}

ingestINaturalist().catch(console.error);