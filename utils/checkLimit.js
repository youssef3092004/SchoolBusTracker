const pool = require("../config/db");

async function checkLimit(schoolId, type) {
  const school = await pool.query(
    `
    SELECT 
      s.id, 
      su.students_count, 
      su.parents_count, 
      su.supervisors_count, 
      su.schoolStaff_count,
      p.max_students, 
      p.max_parent, 
      p.max_supervisor, 
      p.max_schoolStaff
    FROM School s
    JOIN Plan p ON s.plan_id = p.id
    JOIN SchoolUsage su ON s.id = su.school_id
    WHERE s.id = $1
    `,
    [schoolId]
  );

  const row = school.rows[0];

  if (!row) {
    throw {
      userMessage: "School not found.",
      devMessage: `School with id ${schoolId} does not exist.`,
    };
  }

  if (type === "student" && row.students_count >= row.max_students) return true;

  if (type === "parent" && row.parents_count >= row.max_parent) return true;

  if (type === "supervisor" && row.supervisors_count >= row.max_supervisor)
    return true;

  if (type === "schoolstaff" && row.schoolstaff_count >= row.max_schoolstaff)
    return true;

  return false;
}

module.exports = checkLimit;
