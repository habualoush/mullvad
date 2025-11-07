# Mullvad Server Finder

A Node.js website that displays **real** Mullvad VPN servers (all 500+ active servers) and finds the closest server to your location using geolocation and optional ping testing.

## Features

- 🌍 **Real-time Mullvad API integration** - Fetches live server data from Mullvad's official API
- 📍 **Find the closest server** to your current location using browser geolocation
- 🎯 **Distance calculation** using the Haversine formula
- 🔍 **Ping servers** to measure actual latency (requires server to be accessible)
- 🗺️ **Automatic geocoding** of city locations using OpenStreetMap Nominatim API
- 💻 Modern, responsive UI with gradient styling
- 📊 Shows server details: provider, speed, ownership status, and more

## Data Sources

- **Server Data**: [Mullvad API](https://api.mullvad.net/www/relays/wireguard/) - Live WireGuard relay servers
- **Geocoding**: [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/) - City coordinates lookup

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)
- Internet connection (to fetch real-time server data)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up Supabase:
   - Create a free account at [supabase.com](https://supabase.com)
   - Create a new project
   - Go to SQL Editor and run the schema from `supabase-schema.sql`
   - Copy your project URL and anon key from Project Settings > API

3. Configure environment variables:
```bash
cp env.example .env
# Edit .env and add your Supabase credentials
```

4. Populate the database:
```bash
npm run setup-db
```

This will fetch all active Mullvad servers and populate your Supabase database with:
- City coordinates (90+ cities)
- Server locations grouped by city
- Individual server details (500+ servers)

## Running the Application

Start the server:
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Usage

1. Open your browser and navigate to `http://localhost:3000`
2. **Click "Find Closest Server"**:
   - Requests your location (you must allow browser permission)
   - Fetches all active Mullvad servers
   - Geocodes city locations
   - Calculates distances and displays the closest server
   - Optionally click "Ping Server" to test latency
3. **Click "Show All Servers"**:
   - Displays all Mullvad servers grouped by city
   - Shows provider, speed, and server count per location

**Note:** 
- The browser will ask for permission to access your location. You must allow this for the closest server feature to work.
- The Geolocation API requires HTTPS in production (or localhost for development).
- All server data and coordinates are stored in Supabase for instant lookups.

## API Endpoints

- `GET /api/servers` - Returns all active Mullvad WireGuard servers with geocoded coordinates
- `GET /api/closest?lat={latitude}&lon={longitude}` - Returns the closest server to the given coordinates
- `GET /api/ping/:hostname` - Pings a specific server and returns latency

## How It Works

1. **Database**: All Mullvad server data is stored in Supabase (PostgreSQL)
2. **Coordinates**: Pre-populated city coordinates eliminate the need for external geocoding APIs
3. **Distance Calculation**: Haversine formula calculates great-circle distance between user and servers
4. **Ping Testing**: Uses system ping command to measure actual network latency to servers (may not work as Mullvad blocks ICMP)

## Technologies Used

- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL)
- **APIs**: Mullvad API (for initial data population)
- **Frontend**: Vanilla JavaScript, HTML5 Geolocation API, CSS3
- **Distance**: Haversine formula
- **Network Testing**: System ping utility

## Server Count

As of the latest Mullvad data: **~526 active WireGuard servers** across **~90 cities worldwide**

## License

MIT

