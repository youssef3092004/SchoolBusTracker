const pool = require("../../config/db");

async function createBusLocationTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS BusLocation (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      bus_id UUID REFERENCES Bus(id) ON DELETE CASCADE,
      latitude DECIMAL(9,6) NOT NULL,
      longitude DECIMAL(9,6) NOT NULL,
      passenger_count INT DEFAULT 0,
      route_name VARCHAR(100),
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_buslocation_bus_id ON BusLocation(bus_id);
  `);
}

module.exports = createBusLocationTable;
