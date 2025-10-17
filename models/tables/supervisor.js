const pool = require("../../config/db");

async function createSupervisorTable() {
  await pool.query(`
    CREATE SEQUENCE IF NOT EXISTS supervisor_email_seq
    START 1001
    INCREMENT BY 2;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS Supervisor (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      school_id UUID REFERENCES School(id) ON DELETE CASCADE,
      name VARCHAR(50) NOT NULL,
      phone VARCHAR(20),
      address VARCHAR(100),
      language VARCHAR(20) DEFAULT 'EN',
      default_email VARCHAR(255) UNIQUE,
      email VARCHAR(255) UNIQUE,
      password VARCHAR(100),
      governorate VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE OR REPLACE FUNCTION generate_supervisor_email_func()
    RETURNS TRIGGER AS $$
    DECLARE
      seq_number INTEGER;
      name_parts TEXT[];
      initials TEXT := '';
      school_abbr TEXT;
      gov_abbr TEXT;
    BEGIN
      -- Get next sequence number
      seq_number := nextval('supervisor_email_seq');

      -- Split name into parts
      name_parts := string_to_array(lower(NEW.name), ' ');

      -- Build initials like Parent logic
      IF array_length(name_parts, 1) = 1 THEN
        initials := substring(name_parts[1] from 1 for 2);
      ELSIF array_length(name_parts, 1) = 2 THEN
        initials := substring(name_parts[1] from 1 for 1) || substring(name_parts[2] from 1 for 1);
      ELSE
        initials := substring(name_parts[1] from 1 for 1) || substring(name_parts[2] from 1 for 1) || substring(name_parts[3] from 1 for 1);
      END IF;

      -- School abbreviation (first 2 letters)
      school_abbr := substring(lower((SELECT name FROM School WHERE id = NEW.school_id)) from 1 for 2);

      -- Governorate abbreviation (first 3 letters)
      gov_abbr := substring(lower(NEW.governorate) from 1 for 3);

      -- Build default email
      NEW.default_email := initials || '.' || seq_number || '.sv.' || school_abbr || '.' || gov_abbr || '@pinbus.com';

      -- Build default password
      NEW.password := seq_number || '@PinBus';

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await pool.query(`
    DROP TRIGGER IF EXISTS trg_generate_supervisor_email ON Supervisor;

    CREATE TRIGGER trg_generate_supervisor_email
    BEFORE INSERT ON Supervisor
    FOR EACH ROW
    EXECUTE FUNCTION generate_supervisor_email_func();
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_supervisor_email ON Supervisor(email);
    CREATE INDEX IF NOT EXISTS idx_supervisor_default_email ON Supervisor(default_email);
    CREATE INDEX IF NOT EXISTS idx_supervisor_school_id ON Supervisor(school_id);
  `);

  await pool.query(`
    CREATE TRIGGER set_updated_at_supervisor
    BEFORE UPDATE ON Supervisor
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

module.exports = createSupervisorTable;
