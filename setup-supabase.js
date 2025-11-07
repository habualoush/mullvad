require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const fs = require('fs');

// Use service role key to bypass RLS for setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Fetch Mullvad servers
function fetchMullvadServers() {
  return new Promise((resolve, reject) => {
    https.get('https://api.mullvad.net/www/relays/wireguard/', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function setupDatabase() {
  console.log('Setting up Supabase database...\n');

  // Load city coordinates
  const cityCoordinates = JSON.parse(fs.readFileSync('./city-coordinates.json', 'utf8'));

  // 1. Insert city coordinates
  console.log('Inserting city coordinates...');
  const cityData = Object.entries(cityCoordinates).map(([name, coords]) => ({
    name,
    latitude: coords.lat,
    longitude: coords.lon
  }));

  const { data: cities, error: citiesError } = await supabase
    .from('cities')
    .upsert(cityData, { onConflict: 'name' });

  if (citiesError) {
    console.error('Error inserting cities:', citiesError);
  } else {
    console.log(`Successfully inserted ${cityData.length} cities\n`);
  }

  // 2. Fetch and insert Mullvad servers
  console.log('Fetching Mullvad servers...');
  const rawServers = await fetchMullvadServers();
  const activeServers = rawServers.filter(s => s.active);

  console.log(`Found ${activeServers.length} active servers`);

  // Group by city to get unique locations
  const citiesMap = new Map();
  activeServers.forEach(server => {
    const key = `${server.city_name},${server.country_name}`;
    if (!citiesMap.has(key)) {
      citiesMap.set(key, {
        city_name: server.city_name,
        city_code: server.city_code,
        country_name: server.country_name,
        country_code: server.country_code,
        servers: []
      });
    }
    citiesMap.get(key).servers.push(server);
  });

  const locations = Array.from(citiesMap.values());
  console.log(`Processing ${locations.length} unique locations...\n`);

  // Insert server locations
  const locationData = locations.map(loc => ({
    city_name: loc.city_name,
    city_code: loc.city_code,
    country_name: loc.country_name,
    country_code: loc.country_code,
    server_count: loc.servers.length,
    provider: loc.servers[0].provider,
    speed: loc.servers[0].network_port_speed,
    owned: loc.servers[0].owned
  }));

  const { data: locData, error: locError } = await supabase
    .from('server_locations')
    .upsert(locationData, { onConflict: 'city_code,country_code' });

  if (locError) {
    console.error('Error inserting server locations:', locError);
  } else {
    console.log(`Successfully inserted ${locationData.length} server locations\n`);
  }

  // 3. Insert individual servers
  console.log('Inserting individual servers...');
  const serverData = activeServers.map(server => ({
    hostname: server.hostname,
    city_name: server.city_name,
    city_code: server.city_code,
    country_name: server.country_name,
    country_code: server.country_code,
    ipv4_addr_in: server.ipv4_addr_in,
    ipv6_addr_in: server.ipv6_addr_in,
    network_port_speed: server.network_port_speed,
    provider: server.provider,
    owned: server.owned,
    socks_name: server.socks_name
  }));

  const { data: servers, error: serversError } = await supabase
    .from('servers')
    .upsert(serverData, { onConflict: 'hostname' });

  if (serversError) {
    console.error('Error inserting servers:', serversError);
  } else {
    console.log(`Successfully inserted ${serverData.length} servers\n`);
  }

  console.log('Database setup complete!');
}

setupDatabase().catch(console.error);

