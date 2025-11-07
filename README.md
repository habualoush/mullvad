# Mullvad Server Finder

A Node.js website that displays **real** Mullvad VPN servers (all 500+ active servers) and finds the closest server to your location using geolocation and optional ping testing.

**Live Site:** [https://mullvadservers.com/](https://mullvadservers.com/)  
**Repository:** [https://github.com/habualoush/mullvad](https://github.com/habualoush/mullvad)  
**Version:** 1.0.0

## Features

- **Real-time Mullvad API integration** - Fetches live server data from Mullvad's official API
- **Find the closest server** to your current location using browser geolocation
- **Distance calculation** using the Haversine formula
- **Ping servers** to measure actual latency (requires server to be accessible)
- **Automatic geocoding** of city locations using OpenStreetMap Nominatim API
- **Modern, responsive UI** with gradient styling and comprehensive instructions
- **Server details** - Shows provider, speed, ownership status, and more
- **Back to top button** for easy navigation
- **Clickable homepage title** to reset and return to start
- **GitHub Sponsors integration** for project support
- **SEO optimized** with comprehensive meta tags for better search visibility
- **Mobile-friendly** with responsive design and PWA capabilities
- **Privacy-compliant cookie consent** with GDPR/CCPA compliance
- **Google Analytics integration** with anonymized tracking and user consent

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

5. **GitHub Integration (Already Configured)**:
   - Repository: [https://github.com/habualoush/mullvad](https://github.com/habualoush/mullvad)
   - Sponsor Link: [https://github.com/sponsors/habualoush](https://github.com/sponsors/habualoush)
   - All links are pre-configured in the project

6. **Configure SEO Settings (Optional)**:
   - The site is already configured for https://mullvadservers.com/
   - If you want to use a different domain, update all URLs in `public/index.html`
   - Create custom Open Graph images:
     - `og:image` - 1200x630px image saved as `public/og-image.jpg`
     - `twitter:image` - 1200x600px image saved as `public/twitter-card.jpg`

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

## SEO Features

The application includes comprehensive SEO optimization:

- **Meta Tags**: Title, description, keywords, author, robots, and language
- **Open Graph Tags**: For beautiful Facebook/LinkedIn sharing previews
- **Twitter Card Tags**: Optimized cards for Twitter sharing
- **Structured Data**: JSON-LD schema markup for search engines
- **Mobile Meta Tags**: PWA-ready with theme colors and app capabilities
- **Canonical URLs**: Prevents duplicate content issues
- **Semantic HTML**: Proper heading hierarchy and semantic elements

### SEO Configuration

The project is pre-configured for **https://mullvadservers.com/** with:
1. All meta tags updated with the correct domain
2. Canonical URLs properly set
3. Open Graph and Twitter Card tags configured
4. JSON-LD structured data for search engines

To customize:
1. Create social sharing images in the `public/` folder:
   - **Open Graph**: 1200x630px (saved as `og-image.jpg`)
   - **Twitter Card**: 1200x600px (saved as `twitter-card.jpg`)
2. Modify meta descriptions if needed for your use case

## Analytics & Privacy

### Google Analytics Integration

The site includes Google Analytics (GA4) tracking with **privacy-first features**:

- **Measurement ID**: `G-43EGPNC37Y`
- **IP Anonymization**: All IP addresses are anonymized
- **Consent-Based Loading**: Analytics only loads after user consent
- **Cookie Compliance**: Full GDPR/CCPA compliance

### Cookie Consent System

A beautiful, privacy-respecting cookie consent banner that:

- Appears on first visit with a 1-second delay
- Stores user preference in `localStorage`
- Includes "Accept All" and "Decline" options
- Features a detailed cookie policy modal
- Allows users to change preferences anytime via footer link
- Blocks analytics tracking until consent is given

**Features:**
- Clean, professional design matching the site theme
- Fully responsive for mobile devices
- Detailed cookie policy explaining data usage
- Easy-to-access cookie settings in the footer
- No tracking without explicit user consent

### Privacy Compliance

The implementation follows privacy best practices:
- **Opt-in by default**: No tracking until user accepts
- **Transparent**: Clear explanation of what data is collected
- **User control**: Easy to decline or revoke consent
- **Minimal data**: Only anonymous usage statistics
- **No PII**: No personally identifiable information collected

## Contributing

Contributions are welcome! Feel free to:
- Report bugs and issues
- Suggest new features
- Submit pull requests
- Improve documentation
- Star the repository if you find it useful

## Support the Project

If you find this tool useful, please consider:
- **Star the repository** on [GitHub](https://github.com/habualoush/mullvad)
- **[Sponsor on GitHub](https://github.com/sponsors/habualoush)** to support ongoing development
- Share [https://mullvadservers.com/](https://mullvadservers.com/) with others who might benefit from it
- Contribute code or documentation improvements

Your support helps maintain and improve this tool for the privacy community!

## License

MIT

