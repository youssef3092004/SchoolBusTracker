const pool = require("../../config/db");

async function createDriverTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS Driver (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_driver_email ON Driver(email);
  `);

  await pool.query(`
    CREATE TRIGGER set_updated_at_driver
    BEFORE UPDATE ON Driver
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

module.exports = createDriverTable;
