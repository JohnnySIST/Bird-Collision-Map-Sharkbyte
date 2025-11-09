const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Open-Meteo Historical Weather API
 * FREE - No API key needed!
 * Historical data back to 1940
 * https://open-meteo.com/en/docs/historical-weather-api
 */
const OPEN_METEO_API = 'https://archive-api.open-meteo.com/v1/archive';

/**
 * WMO Weather Code Descriptions
 * https://open-meteo.com/en/docs
 */
const WEATHER_CODES = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail'
};

/**
 * Get historical weather for a specific date and location
 */
async function getHistoricalWeather(lat, lon, date) {
  try {
    const dateStr = date.split('T')[0]; // Extract YYYY-MM-DD
    
    const response = await axios.get(OPEN_METEO_API, {
      params: {
        latitude: lat,
        longitude: lon,
        start_date: dateStr,
        end_date: dateStr,
        hourly: [
          'temperature_2m',
          'apparent_temperature',
          'precipitation',
          'rain',
          'snowfall',
          'cloud_cover',
          'wind_speed_10m',
          'wind_direction_10m',
          'wind_gusts_10m',
          'pressure_msl',
          'relative_humidity_2m',
          'visibility',
          'weather_code',
          'is_day'
        ].join(','),
        timezone: 'auto'
      },
      timeout: 30000
    });
    
    return response.data;
  } catch (error) {
    console.error(`  Error fetching weather: ${error.message}`);
    return null;
  }
}

/**
 * Find the hourly data closest to collision time
 */
function findClosestHourlyData(hourlyData, collisionTime) {
  if (!hourlyData || !hourlyData.time) return null;
  
  const collisionTimestamp = new Date(collisionTime).getTime();
  let closestIndex = 0;
  let closestDiff = Infinity;
  
  hourlyData.time.forEach((time, index) => {
    const timeTimestamp = new Date(time).getTime();
    const diff = Math.abs(timeTimestamp - collisionTimestamp);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestIndex = index;
    }
  });
  
  return {
    time: hourlyData.time[closestIndex],
    temperature_2m: hourlyData.temperature_2m[closestIndex],
    apparent_temperature: hourlyData.apparent_temperature[closestIndex],
    precipitation: hourlyData.precipitation[closestIndex],
    rain: hourlyData.rain[closestIndex],
    snowfall: hourlyData.snowfall[closestIndex],
    cloud_cover: hourlyData.cloud_cover[closestIndex],
    wind_speed_10m: hourlyData.wind_speed_10m[closestIndex],
    wind_direction_10m: hourlyData.wind_direction_10m[closestIndex],
    wind_gusts_10m: hourlyData.wind_gusts_10m[closestIndex],
    pressure_msl: hourlyData.pressure_msl[closestIndex],
    relative_humidity_2m: hourlyData.relative_humidity_2m[closestIndex],
    visibility: hourlyData.visibility[closestIndex],
    weather_code: hourlyData.weather_code[closestIndex],
    is_day: hourlyData.is_day[closestIndex]
  };
}

/**
 * Main ingestion process
 */
async function ingestHistoricalWeather() {
  console.log('=== Open-Meteo Historical Weather Ingestion ===\n');
  console.log('✓ Using FREE Open-Meteo API');
  console.log('✓ Real historical weather data back to 1940');
  console.log('✓ No API key required\n');
  
  console.log('Fetching all collisions...');
  const { data: collisions, error } = await supabase
    .from('collision_incidents')
    .select('id, latitude, longitude, date_time')
    .order('date_time', { ascending: false });
  
  if (error) {
    console.error('Error fetching collisions:', error);
    return;
  }
  
  console.log(`Found ${collisions.length} collisions\n`);
  
  let processed = 0;
  let weatherFound = 0;
  let errors = 0;
  
  for (const collision of collisions) {
    try {
      console.log(`\n[${processed + 1}/${collisions.length}] Collision ID: ${collision.id}`);
      console.log(`  Location: (${collision.latitude.toFixed(4)}, ${collision.longitude.toFixed(4)})`);
      console.log(`  Date/Time: ${collision.date_time}`);
      
      // Get historical weather
      const weatherData = await getHistoricalWeather(
        collision.latitude,
        collision.longitude,
        collision.date_time
      );
      
      if (weatherData && weatherData.hourly) {
        // Find the hour closest to collision time
        const closestWeather = findClosestHourlyData(
          weatherData.hourly,
          collision.date_time
        );
        
        if (closestWeather) {
          const weatherDesc = WEATHER_CODES[closestWeather.weather_code] || 'Unknown';
          
          const { error: insertError } = await supabase
            .from('weather_conditions')
            .upsert({
              collision_id: collision.id,
              latitude: collision.latitude,
              longitude: collision.longitude,
              observation_time: closestWeather.time,
              temperature_c: closestWeather.temperature_2m,
              apparent_temperature_c: closestWeather.apparent_temperature,
              precipitation_mm: closestWeather.precipitation,
              rain_mm: closestWeather.rain,
              snowfall_cm: closestWeather.snowfall,
              cloud_cover_percent: closestWeather.cloud_cover,
              wind_speed_kmh: closestWeather.wind_speed_10m,
              wind_direction: closestWeather.wind_direction_10m,
              wind_gusts_kmh: closestWeather.wind_gusts_10m,
              pressure_hpa: closestWeather.pressure_msl,
              relative_humidity: closestWeather.relative_humidity_2m,
              visibility_m: closestWeather.visibility,
              weather_code: closestWeather.weather_code,
              is_day: closestWeather.is_day === 1,
              metadata: {
                weather_description: weatherDesc,
                source: 'Open-Meteo Historical API',
                timezone: weatherData.timezone,
                timezone_abbreviation: weatherData.timezone_abbreviation
              }
            }, {
              onConflict: 'collision_id,observation_time',
              ignoreDuplicates: true
            });
          
          if (!insertError) {
            weatherFound++;
            console.log(`  ✓ Weather data stored`);
            console.log(`    Conditions: ${weatherDesc}`);
            console.log(`    Temp: ${closestWeather.temperature_2m}°C`);
            console.log(`    Wind: ${closestWeather.wind_speed_10m} km/h from ${closestWeather.wind_direction_10m}°`);
            console.log(`    Cloud cover: ${closestWeather.cloud_cover}%`);
            console.log(`    Visibility: ${closestWeather.visibility || 'N/A'}m`);
            console.log(`    ${closestWeather.is_day === 1 ? '☀️ Day' : '🌙 Night'}`);
          } else {
            console.error(`  ✗ Storage error: ${insertError.message}`);
            errors++;
          }
        } else {
          console.log(`  - Could not find matching hourly data`);
        }
      } else {
        console.log(`  - No weather data available for this date/location`);
      }
      
      processed++;
      
      // Be nice to the free API - 1 request per second
      if (processed % 100 === 0) {
        console.log(`\n--- Progress: ${processed}/${collisions.length} ---`);
      }
      await new Promise(resolve => setTimeout(resolve, 1100));
      
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
      errors++;
    }
  }
  
  console.log(`\n\n=== Ingestion Complete ===`);
  console.log(`Collisions processed: ${processed}`);
  console.log(`Weather records created: ${weatherFound}`);
  console.log(`Errors: ${errors}`);
  console.log(`\n✓ Historical weather data is now linked to all your collisions!`);
  console.log(`\n📊 Your frontend can now analyze:`);
  console.log(`  - Wind patterns during collisions`);
  console.log(`  - Visibility conditions (fog = more collisions)`);
  console.log(`  - Day vs night collision rates`);
  console.log(`  - Temperature correlations`);
  console.log(`  - Weather event patterns (storms, clear skies, etc.)`);
  console.log(`\n💡 Example queries:`);
  console.log(`  - "Show collisions during fog (weather_code = 45)"`);
  console.log(`  - "What % of collisions occurred during high winds (>30 km/h)?"`);
  console.log(`  - "Correlation between cloud cover and collision frequency"`);
}

ingestHistoricalWeather().catch(console.error);
