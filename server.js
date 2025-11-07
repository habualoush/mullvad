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

// API endpoint to find closest server (HYBRID APPROACH)
app.get('/api/closest', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'Invalid latitude or longitude' });
  }

  try {
    console.log(`\n[HYBRID] Finding best server for: ${lat}, ${lon}`);
    
    // STEP 1: Get all locations with coordinates (single query)
    const startTime = Date.now();
    const locations = await getServerLocationsWithCoordinates();
    console.log(`[HYBRID] Fetched ${locations.length} locations in ${Date.now() - startTime}ms`);
    
    // STEP 2: Calculate geographic distances to all
    const locationsWithDistance = locations
      .filter(loc => loc.latitude && loc.longitude)
      .map(location => ({
        ...location,
        geoDistance: haversineDistance(lat, lon, location.latitude, location.longitude)
      }))
      .sort((a, b) => a.geoDistance - b.geoDistance);
    
    // STEP 3: Take top 25 closest by geography for better network diversity
    const topCandidates = locationsWithDistance.slice(0, 25);
    console.log(`[HYBRID] Top 25 candidates by distance:`);
    topCandidates.forEach((loc, i) => {
      console.log(`  ${i + 1}. ${loc.city_name}, ${loc.country_name} - ${Math.round(loc.geoDistance)} km`);
    });
    
    // STEP 4: Test actual TCP latency to these candidates (test ALL servers per city)
    console.log(`[HYBRID] Testing TCP latency to servers in top ${topCandidates.length} candidate cities...`);
    const latencyTests = await Promise.all(
      topCandidates.map(async (location) => {
        // Get ALL servers from this location to find the fastest one
        const { data: servers } = await supabase
          .from('servers')
          .select('hostname, ipv4_addr_in, ipv6_addr_in')
          .eq('city_code', location.city_code)
          .eq('country_code', location.country_code);
        
        if (!servers || servers.length === 0) {
          return { ...location, server: null, tcpLatency: null };
        }
        
        // Test ALL servers in this city and pick the fastest
        const serverTests = await Promise.all(
          servers.map(async (server) => {
            if (!server.ipv4_addr_in) return { server, latency: null };
            const tcpLatency = await testServerLatency(server.ipv4_addr_in);
            return { server, latency: tcpLatency };
          })
        );
        
        // Find the server with the lowest latency
        const validTests = serverTests.filter(t => t.latency !== null);
        if (validTests.length === 0) {
          console.log(`  ${location.city_name}: all servers timeout (tested ${servers.length})`);
          return { ...location, server: servers[0], tcpLatency: null };
        }
        
        validTests.sort((a, b) => a.latency - b.latency);
        const bestServer = validTests[0];
        
        console.log(`  ${location.city_name}: ${bestServer.latency}ms (best of ${servers.length} servers)`);
        
        return { ...location, server: bestServer.server, tcpLatency: bestServer.latency };
      })
    );
    
    // STEP 5: Sort by latency and return top 5
    const validResults = latencyTests.filter(r => r.tcpLatency !== null);
    
    let topServers;
    if (validResults.length > 0) {
      // Sort by actual TCP latency and take top 5
      validResults.sort((a, b) => a.tcpLatency - b.tcpLatency);
      topServers = validResults.slice(0, 5);
      console.log(`[HYBRID] Top 5 servers by latency:`);
      topServers.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.city_name} - ${s.tcpLatency}ms`);
      });
    } else {
      // Fallback to closest by distance if all TCP tests failed
      topServers = topCandidates.slice(0, 5);
      // Get server info for each
      for (const server of topServers) {
        const { data: servers } = await supabase
          .from('servers')
          .select('hostname, ipv4_addr_in, ipv6_addr_in')
          .eq('city_code', server.city_code)
          .eq('country_code', server.country_code)
          .limit(1);
        server.server = servers && servers.length > 0 ? servers[0] : null;
      }
      console.log(`[HYBRID] All TCP tests failed, using top 5 by distance`);
    }
    
    // Format response - return array of top 5
    const results = topServers.map(server => ({
      hostname: server.server?.hostname || `${server.city_code}-server`,
      name: server.server?.hostname || `${server.city_code}-server`,
      country: server.country_name,
      country_code: server.country_code,
      city: server.city_name,
      city_code: server.city_code,
      latitude: server.latitude,
      longitude: server.longitude,
      ipv4: server.server?.ipv4_addr_in,
      ipv6: server.server?.ipv6_addr_in,
      provider: server.provider,
      owned: server.owned,
      speed: server.speed,
      distance: Math.round(server.geoDistance),
      serverCount: server.server_count,
      tcpLatency: server.tcpLatency
    }));
    
    console.log(`[HYBRID] Total time: ${Date.now() - startTime}ms\n`);
    res.json(results);
    
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

