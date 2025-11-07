-- Drop existing tables if they exist (careful in production!)
DROP TABLE IF EXISTS servers CASCADE;
DROP TABLE IF EXISTS server_locations CASCADE;
DROP TABLE IF EXISTS cities CASCADE;

-- Table: cities (coordinates for distance calculation)
CREATE TABLE cities (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: server_locations (grouped by city)
CREATE TABLE server_locations (
  id BIGSERIAL PRIMARY KEY,
  city_name VARCHAR(255) NOT NULL,
  city_code VARCHAR(10) NOT NULL,
  country_name VARCHAR(255) NOT NULL,
  country_code VARCHAR(10) NOT NULL,
  server_count INTEGER DEFAULT 0,
  provider VARCHAR(255),
  speed INTEGER,
  owned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(city_code, country_code),
  FOREIGN KEY (city_name) REFERENCES cities(name) ON DELETE CASCADE
);

-- Table: servers (individual Mullvad servers)
CREATE TABLE servers (
  id BIGSERIAL PRIMARY KEY,
  hostname VARCHAR(255) UNIQUE NOT NULL,
  city_name VARCHAR(255) NOT NULL,
  city_code VARCHAR(10) NOT NULL,
  country_name VARCHAR(255) NOT NULL,
  country_code VARCHAR(10) NOT NULL,
  ipv4_addr_in VARCHAR(45),
  ipv6_addr_in VARCHAR(45),
  network_port_speed INTEGER,
  provider VARCHAR(255),
  owned BOOLEAN DEFAULT FALSE,
  socks_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX idx_servers_city_code ON servers(city_code);
CREATE INDEX idx_servers_country_code ON servers(country_code);
CREATE INDEX idx_server_locations_city_code ON server_locations(city_code);
CREATE INDEX idx_cities_name ON cities(name);

-- Enable Row Level Security (RLS)
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE servers ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public read access
CREATE POLICY "Allow public read access on cities" 
  ON cities FOR SELECT 
  USING (true);

CREATE POLICY "Allow public read access on server_locations" 
  ON server_locations FOR SELECT 
  USING (true);

CREATE POLICY "Allow public read access on servers" 
  ON servers FOR SELECT 
  USING (true);

-- Create policies to allow inserts (for setup script)
CREATE POLICY "Allow service role to insert cities" 
  ON cities FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow service role to insert server_locations" 
  ON server_locations FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow service role to insert servers" 
  ON servers FOR INSERT 
  WITH CHECK (true);

-- Create policies to allow updates (for setup script)
CREATE POLICY "Allow service role to update cities" 
  ON cities FOR UPDATE 
  USING (true);

CREATE POLICY "Allow service role to update server_locations" 
  ON server_locations FOR UPDATE 
  USING (true);

CREATE POLICY "Allow service role to update servers" 
  ON servers FOR UPDATE 
  USING (true);

