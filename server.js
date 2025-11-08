require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Serve static files from public directory
app.use(express.static('public'));

// API endpoint to get Google Maps API key
app.get('/api/maps-key', (req, res) => {
  res.json({ apiKey: process.env.GOOGLE_MAPS_API_KEY || '' });
});

// Get server locations with coordinates (single optimized query)
async function getServerLocationsWithCoordinates() {
  try {
    const { data, error } = await supabase
      .from('server_locations')
      .select(`
        *,
        cities!inner(latitude, longitude)
      `)
      .order('country_name', { ascending: true })
      .order('city_name', { ascending: true });
    
    if (error) throw error;
    
    // Flatten the structure
    return (data || []).map(location => ({
      ...location,
      latitude: location.cities?.latitude,
      longitude: location.cities?.longitude
    }));
  } catch (error) {
    console.error('Error fetching server locations:', error.message);
    return [];
  }
}

// Test TCP connection latency to a server with multiple port fallback
async function testTCPLatency(hostname, port = 443, timeout = 5000) {
  return new Promise((resolve) => {
    const net = require('net');
    const start = Date.now();
    const socket = new net.Socket();
    
    // Set socket timeout
    socket.setTimeout(timeout);
    
    const cleanup = () => {
      try {
        socket.destroy();
      } catch (e) {
        // Ignore cleanup errors
      }
    };
    
    socket.on('connect', () => {
      const latency = Date.now() - start;
      cleanup();
      resolve(latency);
    });
    
    socket.on('timeout', () => {
      cleanup();
      resolve(null);
    });
    
    socket.on('error', (err) => {
      cleanup();
      resolve(null);
    });
    
    try {
      socket.connect(port, hostname);
    } catch (error) {
      cleanup();
      resolve(null);
    }
  });
}

// Test server with fallback to multiple ports
async function testServerLatency(hostname) {
  // Try multiple ports that Mullvad might have open
  // Port 80 (HTTP), 443 (HTTPS), or just use the hostname
  const ports = [443, 80];
  
  for (const port of ports) {
    const latency = await testTCPLatency(hostname, port, 4000);
    if (latency !== null) {
      return latency;
    }
  }
  
  return null;
}

// Ping a server to measure latency
async function pingServer(hostname) {
  try {
    const { stdout } = await execAsync(`ping -c 3 -W 2 ${hostname}`);
    const match = stdout.match(/time=([0-9.]+) ms/);
    if (match) {
      return parseFloat(match[1]);
    }
  } catch (error) {
    // Ping failed or timed out
  }
  return null;
}

// API endpoint to get all server locations
app.get('/api/servers', async (req, res) => {
  try {
    const locations = await getServerLocationsWithCoordinates();
    
    const cityList = locations.map(loc => ({
      city: loc.city_name,
      country: loc.country_name,
      country_code: loc.country_code,
      city_code: loc.city_code,
      serverCount: loc.server_count,
      provider: loc.provider,
      speed: loc.speed,
      owned: loc.owned
    }));

    console.log(`Returning ${cityList.length} server locations`);
    res.json(cityList);
  } catch (error) {
    console.error('Error in /api/servers:', error);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// API endpoint to get all server locations with coordinates (for map view)
app.get('/api/servers-map', async (req, res) => {
  try {
    const locations = await getServerLocationsWithCoordinates();
    
    const cityList = locations.map(loc => ({
      city: loc.city_name,
      country: loc.country_name,
      country_code: loc.country_code,
      city_code: loc.city_code,
      serverCount: loc.server_count,
      provider: loc.provider,
      speed: loc.speed,
      owned: loc.owned,
      latitude: loc.latitude,
      longitude: loc.longitude
    }));

    console.log(`Returning ${cityList.length} server locations with coordinates for map`);
    res.json(cityList);
  } catch (error) {
    console.error('Error in /api/servers-map:', error);
    res.status(500).json({ error: 'Failed to fetch servers with coordinates' });
  }
});

// API endpoint to get individual servers for a specific city
app.get('/api/servers/:city_code/:country_code', async (req, res) => {
  const { city_code, country_code } = req.params;
  
  try {
    const { data: servers, error } = await supabase
      .from('servers')
      .select('hostname, city_name, country_name, ipv4_addr_in, ipv6_addr_in, network_port_speed, provider, owned')
      .eq('city_code', city_code)
      .eq('country_code', country_code)
      .order('hostname', { ascending: true });
    
    if (error) throw error;
    
    console.log(`Returning ${servers?.length || 0} servers for ${city_code}, ${country_code}`);
    res.json(servers || []);
  } catch (error) {
    console.error(`Error fetching servers for ${city_code}, ${country_code}:`, error);
    res.status(500).json({ error: 'Failed to fetch servers for city' });
  }
});

// API endpoint to find closest server (CLIENT-SIDE LATENCY TESTING)
app.get('/api/closest', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'Invalid latitude or longitude' });
  }

  try {
    console.log(`\n[CLIENT-SIDE] Finding candidate servers for: ${lat}, ${lon}`);
    
    // STEP 1: Get all locations with coordinates (single query)
    const startTime = Date.now();
    const locations = await getServerLocationsWithCoordinates();
    console.log(`[CLIENT-SIDE] Fetched ${locations.length} locations in ${Date.now() - startTime}ms`);
    
    // STEP 2: Calculate geographic distances to all
    const locationsWithDistance = locations
      .filter(loc => loc.latitude && loc.longitude)
      .map(location => ({
        ...location,
        geoDistance: haversineDistance(lat, lon, location.latitude, location.longitude)
      }))
      .sort((a, b) => a.geoDistance - b.geoDistance);
    
    // STEP 3: Take top 25 closest by geography for browser to test
    const topCandidates = locationsWithDistance.slice(0, 25);
    console.log(`[CLIENT-SIDE] Top 25 candidates by distance (browser will test latency):`);
    topCandidates.forEach((loc, i) => {
      console.log(`  ${i + 1}. ${loc.city_name}, ${loc.country_name} - ${Math.round(loc.geoDistance)} km`);
    });
    
    // STEP 4: Get a representative server from each candidate location
    const candidatesWithServers = await Promise.all(
      topCandidates.map(async (location) => {
        // Get one server from this location (browser will test it)
        const { data: servers } = await supabase
          .from('servers')
          .select('hostname, ipv4_addr_in, ipv6_addr_in')
          .eq('city_code', location.city_code)
          .eq('country_code', location.country_code)
          .limit(1);
        
        const server = servers && servers.length > 0 ? servers[0] : null;
        
        return {
          hostname: server?.hostname || `${location.city_code}-server`,
          name: server?.hostname || `${location.city_code}-server`,
          country: location.country_name,
          country_code: location.country_code,
          city: location.city_name,
          city_code: location.city_code,
          latitude: location.latitude,
          longitude: location.longitude,
          ipv4: server?.ipv4_addr_in,
          ipv6: server?.ipv6_addr_in,
          provider: location.provider,
          owned: location.owned,
          speed: location.speed,
          distance: Math.round(location.geoDistance),
          serverCount: location.server_count,
          tcpLatency: null // Browser will test this
        };
      })
    );
    
    console.log(`[CLIENT-SIDE] Returning ${candidatesWithServers.length} candidates for browser testing`);
    console.log(`[CLIENT-SIDE] Total time: ${Date.now() - startTime}ms\n`);
    res.json(candidatesWithServers);
    
  } catch (error) {
    console.error('Error in /api/closest:', error);
    res.status(500).json({ error: 'Failed to find closest server' });
  }
});

// API endpoint to test server latency via TCP
app.get('/api/ping/:hostname', async (req, res) => {
  const { hostname } = req.params;
  
  try {
    // Get server IP from database
    const { data: servers } = await supabase
      .from('servers')
      .select('ipv4_addr_in')
      .eq('hostname', hostname)
      .limit(1);
    
    const server = servers && servers.length > 0 ? servers[0] : null;
    
    if (!server || !server.ipv4_addr_in) {
      return res.json({ hostname, latency: null, status: 'error' });
    }
    
    console.log(`Testing ${hostname} (${server.ipv4_addr_in})...`);
    
    // Test TCP connection to the server's IP with multiple port fallback
    const latency = await testServerLatency(server.ipv4_addr_in);
    
    if (latency !== null) {
      console.log(`  ✓ ${hostname}: ${latency}ms`);
      res.json({ hostname, latency: Math.round(latency), status: 'success' });
    } else {
      console.log(`  ✗ ${hostname}: timeout`);
      res.json({ hostname, latency: null, status: 'timeout' });
    }
  } catch (error) {
    console.error(`  ✗ Error testing ${hostname}:`, error.message);
    res.json({ hostname, latency: null, status: 'timeout' });
  }
});

// Haversine formula to calculate distance between two points
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRadians = (degree) => (degree * Math.PI) / 180;
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Fetching Mullvad servers...`);
});

