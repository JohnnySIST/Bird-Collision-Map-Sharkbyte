import { fetchAllCollisions } from './DataAPI_supabase';

(async () => {
  try {
    const data = await fetchAllCollisions();
    console.log('fetchAllCollisions result:', data);
  } catch (err) {
    console.error('Error:', err);
  }
})();
