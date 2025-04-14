CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'basic' CHECK (role IN ('admin', 'basic'))
);

INSERT INTO users (id, name, role) VALUES
('admin-user-001', 'Admin User', 'admin'),
('user-001', 'Basic User', 'basic');

CREATE TABLE proteins (
  protein_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(1000),
  molecular_weight FLOAT CHECK (molecular_weight > 0),
  sequence_length INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sequence_url VARCHAR(255)
);

CREATE TABLE fragments (
  fragment_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  protein_id UUID REFERENCES proteins(protein_id) ON DELETE CASCADE,
  sequence VARCHAR(50) CHECK (sequence ~ '^[A-Z]{2,50}$'),
  start_position INTEGER,
  end_position INTEGER,
  secondary_structure VARCHAR(50) CHECK (secondary_structure ~ '^[HEC]+$'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  url VARCHAR(255)
);

CREATE TABLE motifs (
  motif_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fragment_id UUID REFERENCES fragments(fragment_id) ON DELETE CASCADE,
  motif_pattern VARCHAR(50) NOT NULL,
  motif_type VARCHAR(50),
  start_position INTEGER,
  end_position INTEGER,
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
