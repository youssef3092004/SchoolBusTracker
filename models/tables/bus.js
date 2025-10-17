const pool = require("../../config/db");

async function createBusTable() {
  await pool.query(`CREATE SEQUENCE IF NOT EXISTS bus_number_seq START 111;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS Bus (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      school_id UUID REFERENCES public.School(id) ON DELETE CASCADE,
      driver_id UUID REFERENCES public.Driver(id) ON DELETE SET NULL,
      supervisor_id UUID REFERENCES public.Supervisor(id) ON DELETE SET NULL,
      bus_number INT UNIQUE DEFAULT nextval('bus_number_seq'),
      capacity INT NOT NULL,
      status bus_status DEFAULT 'active',
      route_name VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_bus_school_id ON Bus(school_id);
    CREATE INDEX IF NOT EXISTS idx_bus_driver_id ON Bus(driver_id);
    CREATE INDEX IF NOT EXISTS idx_bus_number ON Bus(bus_number);
  `);

  await pool.query(`
    CREATE TRIGGER set_updated_at_bus
    BEFORE UPDATE ON Bus
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

module.exports = createBusTable;
