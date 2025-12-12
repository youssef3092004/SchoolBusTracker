const pool = require("../config/db");

const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      if (req.user.role !== "schoolStaff") {
        return next();
      }

      const result = await pool.query(
        `
    SELECT *
      FROM SchoolStaff ss
      JOIN RolePermission rp ON ss.role = rp.role
      JOIN Permission p ON rp.permission_id = p.id
      WHERE ss.id = $1 AND p.name = $2 AND rp.is_allowed = TRUE
    `,
        [userId, permission]
      );
      if (result.rows.length > 0) {
        return next();
      } else {
        return res
          .status(403)
          .json({ success: false, message: "Forbidden: Access is denied" });
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  };
};

module.exports = checkPermission;
