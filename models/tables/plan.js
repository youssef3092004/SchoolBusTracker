const pool = require("../../config/db");

async function createPlanTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS Plan (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      max_students INT NOT NULL,
      max_parent INT NOT NULL,
      max_supervisor INT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      description TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS plan_index ON Plan(name);`);

  await pool.query(`
    CREATE TRIGGER update_plan_updated_at
    BEFORE UPDATE ON Plan
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

module.exports = createPlanTable;
