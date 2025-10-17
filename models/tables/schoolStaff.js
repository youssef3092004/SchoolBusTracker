const pool = require("../../config/db");

async function createSchoolStaffTable() {
  await pool.query(`
        CREATE TABLE IF NOT EXISTS SchoolStaff (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            school_id UUID REFERENCES School(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(100) NOT NULL,
            role VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

  await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_schoolStaff_email ON SchoolStaff(email);
        CREATE INDEX IF NOT EXISTS idx_schoolStaff_name ON SchoolStaff(name);
    `);

  await pool.query(`
        CREATE TRIGGER set_updated_at_schoolStaff
        BEFORE UPDATE ON SchoolStaff
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
}

module.exports = createSchoolStaffTable;
