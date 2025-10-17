const pool = require("../config/db");

async function createFunctions() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  `);

  await pool.query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
}

module.exports = createFunctions;
