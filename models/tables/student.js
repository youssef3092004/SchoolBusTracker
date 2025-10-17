const pool = require("../../config/db");

async function createStudentTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS Student (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      parent_id UUID REFERENCES Parent(id) ON DELETE CASCADE,
      school_id UUID REFERENCES School(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      student_code VARCHAR(20) UNIQUE,
      birthday DATE NOT NULL,
      grade VARCHAR(50),
      class_name VARCHAR(50),
      image_url VARCHAR(255),
      address VARCHAR(255),
      parent_note VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_student_school_id ON Student(school_id);
    CREATE INDEX IF NOT EXISTS idx_student_parent_id ON Student(parent_id);
  `);

  await pool.query(`
    CREATE TRIGGER set_updated_at_student
    BEFORE UPDATE ON Student
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

module.exports = createStudentTable;
