const pool = require("../../config/db");

async function createPermissionTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS Permission (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      description TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(
    `CREATE INDEX IF NOT EXISTS name_index ON Permission(name);`
  );

  await pool.query(`
    CREATE TRIGGER update_permission_updated_at
    BEFORE UPDATE ON Permission
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

module.exports = createPermissionTable;
