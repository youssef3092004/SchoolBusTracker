const pool = require("../../config/db");

async function createAttendanceTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS Attendance (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      student_id UUID REFERENCES Student(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      status attendance_status NOT NULL,
      reported_by_parent BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON Attendance(student_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON Attendance(date);
  `);

  await pool.query(`
    CREATE TRIGGER set_updated_at_attendance
    BEFORE UPDATE ON Attendance
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

module.exports = createAttendanceTable;
