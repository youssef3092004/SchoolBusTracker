const pool = require("../../config/db");

async function createAdminTable() {
  await pool.query(`
        CREATE TABLE IF NOT EXISTS Admin (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(100) NOT NULL,
            phone VARCHAR(15),
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

  await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_admin_email ON Admin(email);
        `);

  await pool.query(`
    CREATE TRIGGER set_updated_at_admin
    BEFORE UPDATE ON Admin
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

module.exports = createAdminTable;
