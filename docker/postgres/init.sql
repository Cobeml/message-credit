-- Initialize database for community P2P lending platform
-- This script runs when the PostgreSQL container starts for the first time

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create development and test databases
CREATE DATABASE community_lending_dev;
CREATE DATABASE community_lending_test;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE community_lending TO postgres;
GRANT ALL PRIVILEGES ON DATABASE community_lending_dev TO postgres;
GRANT ALL PRIVILEGES ON DATABASE community_lending_test TO postgres;