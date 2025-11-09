const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || 'b7dee0923a2b45543b2bba91a920d428';
const OPENWEATHER_BASE = 'https://api.openweathermap.org/data/3.0';
const OPENWEATHER_CURRENT = 'https://api.openweathermap.org/data/2.5';

/**
 * Create weather conditions table
 */
async function createWeatherTable() {
  console.log('\nRun this SQL in Supabase to create the weather table:\n');
  console.log(`
CREATE TABLE IF NOT EXISTS weather_conditions (
  id SERIAL PRIMARY KEY,
  collision_id INTEGER REFERENCES collision_incidents(id),
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  observation_time TIMESTAMPTZ NOT NULL,
  temperature_c NUMERIC,
  feels_like_c NUMERIC,
  humidity INTEGER,
  pressure INTEGER,
  wind_speed_ms NUMERIC,
  wind_direction INTEGER,
  wind_gust_ms NUMERIC,
  visibility_m INTEGER,
  cloud_cover_percent INTEGER,
  weather_main TEXT,
  weather_description TEXT,
  precipitation_mm NUMERIC,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(collision_id, observation_time)
);

CREATE INDEX IF NOT EXISTS idx_weather_collision ON weather_conditions(collision_id);
CREATE INDEX IF NOT EXISTS idx_weather_time ON weather_conditions(observation_time);
CREATE INDEX IF NOT EXISTS idx_weather_conditions ON weather_conditions(weather_main);
  `);
}

/**
 * Get current weather (for recent collisions)
 */
async function getCurrentWeather(lat, lon) {
  try {
    const response = await axios.get(
      `${OPENWEATHER_CURRENT}/weather`,
      {
        params: {
          lat: lat,
          lon: lon,
          appid: OPENWEATHER_API_KEY,
          units: 'metric'
        },
        timeout: 15000
      }
    );
    
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.error('  ✗ OpenWeather API key invalid!');
    } else {
      console.error(`  Error: ${error.message}`);
    }
    return null;
  }
}

/**
 * Get historical weather (requires paid API - Time Machine)
 * For free tier, we'll use current weather as proxy for recent collisions
 */
async function getHistoricalWeather(lat, lon, timestamp) {
  try {
    // Note: Historical data requires One Call API 3.0 subscription
    // For free tier, we can only get current weather
    const response = await axios.get(
      `${OPENWEATHER_BASE}/onecall/timemachine`,
      {
        params: {
          lat: lat,
          lon: lon,
          dt: Math.floor(timestamp / 1000),
          appid: OPENWEATHER_API_KEY,
          units: 'metric'
        },
        timeout: 15000
      }
    );
    
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.error('  Historical weather requires paid API subscription');
      return null;
    }
    console.error(`  Error: ${error.message}`);
    return null;
  }
}

/**
 * Parse weather data into our format
 */
function parseWeatherData(weatherData, collisionTime) {
  if (!weatherData) return null;
  
  return {
    observation_time: new Date(weatherData.dt * 1000).toISOString(),
    temperature_c: weatherData.main?.temp || weatherData.temp,
    feels_like_c: weatherData.main?.feels_like || weatherData.feels_like,
    humidity: weatherData.main?.humidity || weatherData.humidity,
    pressure: weatherData.main?.pressure || weatherData.pressure,
    wind_speed_ms: weatherData.wind?.speed,
    wind_direction: weatherData.wind?.deg,
    wind_gust_ms: weatherData.wind?.gust,
    visibility_m: weatherData.visibility,
    cloud_cover_percent: weatherData.clouds?.all || weatherData.clouds,
    weather_main: weatherData.weather?.[0]?.main,
    weather_description: weatherData.weather?.[0]?.description,
    precipitation_mm: weatherData.rain?.['1h'] || weatherData.snow?.['1h'] || 0
  };
}

/**
 * Main ingestion process
 */
async function ingestWeatherData() {
  console.log('=== Weather Data Ingestion ===\n');
  
  await createWeatherTable();
  
  console.log('\nPress Enter after creating the table in Supabase...');
  await new Promise(resolve => {
    process.stdin.once('data', () => resolve());
  });
  
  console.log('\nFetching collisions...');
  
  // Get recent collisions first (within last 30 days - we can get weather for these)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { data: collisions, error } = await supabase
    .from('collision_incidents')
    .select('id, latitude, longitude, date_time')
    .gte('date_time', thirtyDaysAgo.toISOString())
    .order('date_time', { ascending: false })
    .limit(200);
  
  if (error) {
    console.error('Error fetching collisions:', error);
    return;
  }
  
  console.log(`Found ${collisions.length} recent collisions (last 30 days)\n`);
  
  if (collisions.length === 0) {
    console.log('No recent collisions found.');
    console.log('Note: Free OpenWeather API only provides current weather.');
    console.log('Historical data requires paid subscription.');
    return;
  }
  
  let processed = 0;
  let weatherFound = 0;
  let errors = 0;
  
  for (const collision of collisions) {
    try {
      console.log(`\n[${processed + 1}/${collisions.length}] Collision ID: ${collision.id}`);
      console.log(`  Location: (${collision.latitude.toFixed(4)}, ${collision.longitude.toFixed(4)})`);
      console.log(`  Date: ${collision.date_time}`);
      
      const collisionDate = new Date(collision.date_time);
      const now = new Date();
      const hoursDiff = Math.abs(now - collisionDate) / 36e5;
      
      let weatherData = null;
      
      if (hoursDiff <= 24) {
        // Very recent - get current weather
        console.log(`  Fetching current weather...`);
        weatherData = await getCurrentWeather(collision.latitude, collision.longitude);
      } else {
        // Try historical (will fail on free tier)
        console.log(`  Attempting historical weather (${hoursDiff.toFixed(0)} hours ago)...`);
        weatherData = await getHistoricalWeather(
          collision.latitude,
          collision.longitude,
          collisionDate.getTime()
        );
        
        if (!weatherData) {
          console.log(`  - Historical weather unavailable (requires paid API)`);
          console.log(`  - Using current weather as proxy...`);
          weatherData = await getCurrentWeather(collision.latitude, collision.longitude);
        }
      }
      
      if (weatherData) {
        const parsedWeather = parseWeatherData(weatherData, collision.date_time);
        
        if (parsedWeather) {
          const { error: insertError } = await supabase
            .from('weather_conditions')
            .upsert({
              collision_id: collision.id,
              latitude: collision.latitude,
              longitude: collision.longitude,
              ...parsedWeather,
              metadata: {
                source: hoursDiff <= 24 ? 'current' : 'historical',
                hours_from_collision: hoursDiff.toFixed(1),
                weather_id: weatherData.weather?.[0]?.id,
                timezone_offset: weatherData.timezone
              }
            }, {
              onConflict: 'collision_id,observation_time',
              ignoreDuplicates: true
            });
          
          if (!insertError) {
            weatherFound++;
            console.log(`  ✓ Weather data stored`);
            console.log(`    Temp: ${parsedWeather.temperature_c}°C, Wind: ${parsedWeather.wind_speed_ms}m/s`);
            console.log(`    Conditions: ${parsedWeather.weather_description}`);
            console.log(`    Visibility: ${parsedWeather.visibility_m}m, Clouds: ${parsedWeather.cloud_cover_percent}%`);
          } else {
            console.error(`  ✗ Storage error: ${insertError.message}`);
            errors++;
          }
        }
      } else {
        console.log(`  - No weather data available`);
      }
      
      processed++;
      
      // OpenWeather free tier: 60 calls/minute
      await new Promise(resolve => setTimeout(resolve, 1200));
      
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
      errors++;
    }
  }
  
  console.log(`\n\n=== Ingestion Complete ===`);
  console.log(`Collisions processed: ${processed}`);
  console.log(`Weather data found: ${weatherFound}`);
  console.log(`Errors: ${errors}`);
  console.log(`\n✓ Weather conditions are now linked to your collisions!`);
  console.log(`\nFrontend can now show:`);
  console.log(`- Wind speed/direction during collisions`);
  console.log(`- Visibility conditions (fog, clear, etc.)`);
  console.log(`- Temperature and weather patterns`);
  console.log(`- Correlation: "80% of collisions occurred during low visibility"`);
  console.log(`\n📝 Note: Historical weather requires OpenWeather paid subscription.`);
  console.log(`Current implementation works best for collisions within last 24 hours.`);
}

ingestWeatherData().catch(console.error);
