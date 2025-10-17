const pool = require("../../config/db");

async function createBusAssignmentTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS BusAssignment (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      supervisor_id UUID REFERENCES Supervisor(id) ON DELETE CASCADE,
      student_id UUID REFERENCES Student(id) ON DELETE CASCADE,
      route_name VARCHAR(100),
      pickup_time TIME,
      dropoff_time TIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_assignment_supervisor_id ON BusAssignment(supervisor_id);
    CREATE INDEX IF NOT EXISTS idx_assignment_student_id ON BusAssignment(student_id);
    `);

  await pool.query(`
    CREATE TRIGGER set_updated_at_assignment
    BEFORE UPDATE ON BusAssignment
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

module.exports = createBusAssignmentTable;
