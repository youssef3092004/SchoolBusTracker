const pool = require("../../config/db");

async function createParentTable() {
  await pool.query(`
    CREATE SEQUENCE IF NOT EXISTS default_email_seq
    START 1000
    INCREMENT BY 2;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS Parent (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      school_id UUID REFERENCES School(id) ON DELETE CASCADE,
      name VARCHAR(50) NOT NULL,
      phone VARCHAR(20),
      address VARCHAR(100),
      latitude DECIMAL(9,6),
      longitude DECIMAL(9,6),
      language VARCHAR(20) DEFAULT 'EN',
      relationship VARCHAR(20),
      default_email VARCHAR(255) UNIQUE,
      email VARCHAR(255) UNIQUE,
      password VARCHAR(100),
      governorate VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE OR REPLACE FUNCTION generate_parent_email_func()
RETURNS TRIGGER AS $$
DECLARE
  seq_number INTEGER;
  name_parts TEXT[];
  initials TEXT := '';
  school_abbr TEXT;
  gov_abbr TEXT;
BEGIN
  -- 1️⃣ Get next sequence number
  seq_number := nextval('default_email_seq');

  -- 2️⃣ Split the name into parts (e.g. ['youssef', 'ahmed', 'abdelkader'])
  name_parts := string_to_array(lower(NEW.name), ' ');

  -- 3️⃣ Build initials:
  -- if 1 part: take first 2 letters
  -- if 2 parts: first letter of each part
  -- if 3+ parts: first letter of each part up to 3 total
  IF array_length(name_parts, 1) = 1 THEN
    initials := substring(name_parts[1] from 1 for 2);
  ELSIF array_length(name_parts, 1) = 2 THEN
    initials := substring(name_parts[1] from 1 for 1) || substring(name_parts[2] from 1 for 1);
  ELSE
    initials := substring(name_parts[1] from 1 for 1) || substring(name_parts[2] from 1 for 1) || substring(name_parts[3] from 1 for 1);
  END IF;

  -- 4️⃣ Get school name abbreviation (first two letters)
  school_abbr := substring(lower((SELECT name FROM School WHERE id = NEW.school_id)) from 1 for 2);

  -- 5️⃣ Governorate abbreviation (first 3 letters)
  gov_abbr := substring(lower(NEW.governorate) from 1 for 3);

  -- 6️⃣ Build default email
  NEW.default_email := initials || '.' || seq_number || '.pt.' || school_abbr || '.' || gov_abbr || '@pinbus.com';

  -- 7️⃣ Build default password
  NEW.password := seq_number || '@PinBus';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

  `);

  await pool.query(`
    DROP TRIGGER IF EXISTS trg_generate_parent_email ON Parent;

    CREATE TRIGGER trg_generate_parent_email
    BEFORE INSERT ON Parent
    FOR EACH ROW
    EXECUTE FUNCTION generate_parent_email_func();
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_parent_email ON Parent(email);
    CREATE INDEX IF NOT EXISTS idx_parent_default_email ON Parent(default_email);
    CREATE INDEX IF NOT EXISTS idx_parent_school_id ON Parent(school_id);
  `);

  await pool.query(`
    CREATE TRIGGER set_updated_at_parent
    BEFORE UPDATE ON Parent
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

module.exports = createParentTable;
