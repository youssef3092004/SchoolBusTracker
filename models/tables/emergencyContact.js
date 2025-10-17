const pool = require("../../config/db");

async function createEmergencyContactTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS EmergencyContact (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      student_id UUID REFERENCES Student(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      relationship VARCHAR(50),
      phone VARCHAR(20) NOT NULL,
      email VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_emergency_student_id ON EmergencyContact(student_id);
  `);

  await pool.query(`
    CREATE TRIGGER set_updated_at_emergency
    BEFORE UPDATE ON EmergencyContact
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

module.exports = createEmergencyContactTable;
