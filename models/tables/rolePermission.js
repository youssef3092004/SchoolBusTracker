const pool = require("../../config/db");

async function createRolePermissionTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS RolePermission (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      role VARCHAR(50) NOT NULL,
      permission_id UUID REFERENCES Permission(id) ON DELETE CASCADE,
      is_allowed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(
    `CREATE INDEX IF NOT EXISTS role_index ON RolePermission(role);`
  );

  await pool.query(`
    CREATE TRIGGER update_rolePermission_updated_at
    BEFORE UPDATE ON RolePermission
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

module.exports = createRolePermissionTable;
