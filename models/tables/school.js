const pool = require("../../config/db");

async function createSchoolTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS School (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      plan UUID REFERENCES Plan(id) ON DELETE SET NULL,
      name VARCHAR(50) NOT NULL,
      address VARCHAR(50) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      email VARCHAR(50) UNIQUE NOT NULL,
      governorate VARCHAR(50) NOT NULL,
      password VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_school_email ON School(email);
    CREATE INDEX IF NOT EXISTS idx_school_name ON School(name);
  `);

  await pool.query(`
    CREATE TRIGGER set_updated_at_school
    BEFORE UPDATE ON School
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

module.exports = createSchoolTable;
