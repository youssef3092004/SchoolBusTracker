const pool = require("../config/db");

const getMaxLimitAndUsed = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Admins only",
      });
    }
    const { school_id } = req.params;

    if (!school_id) {
      return res.status(400).json({
        success: false,
        message: "school_id parameter is required",
      });
    }

    const result = await pool.query(
      `
        SELECT 
            p.max_students,
            su.students_count,
            p.max_parent,
            su.parents_count,
            p.max_supervisor,
            su.supervisors_count,
            p.max_schoolStaff,
            su.schoolStaff_count
        FROM School s
        JOIN SchoolUsage su ON s.id = su.school_id
        JOIN Plan p ON s.plan_id = p.id
        WHERE s.id = $1
    `,
      [school_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "School not found Or no usage data available",
      });
    }
    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error in getMaxLimitAndUsed controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getMaxLimitAndUsed,
};
