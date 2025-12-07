const pool = require("../../config/db");

async function createSchoolUsageTable() {
  await pool.query(`
  CREATE TABLE IF NOT EXISTS SchoolUsage (
  school_id UUID REFERENCES School(id) ON DELETE CASCADE,
  students_count INT DEFAULT 0,
  parents_count INT DEFAULT 0,
  supervisors_count INT DEFAULT 0,
  schoolStaff_count INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (school_id)
);
    `);

  await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_school_usage_students_count ON SchoolUsage(students_count);
          CREATE INDEX IF NOT EXISTS idx_school_usage_parents_count ON SchoolUsage(parents_count);
          CREATE INDEX IF NOT EXISTS idx_school_usage_supervisors_count ON SchoolUsage(supervisors_count);
      `);

  await pool.query(`
        CREATE TRIGGER set_updated_at_school_usage
        BEFORE UPDATE ON SchoolUsage
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
}

module.exports = createSchoolUsageTable;
