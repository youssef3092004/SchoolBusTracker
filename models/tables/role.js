const pool = require("../../config/db");

async function createRoleTable () {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS Role (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(50) UNIQUE NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_role_name ON Role(name);
    `);

    await pool.query(`
        CREATE TRIGGER set_updated_at_role
        BEFORE UPDATE ON Role
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
    }

module.exports = createRoleTable;