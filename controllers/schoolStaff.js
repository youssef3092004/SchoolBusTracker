const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { validateEmail, validatePassword } = require("../utils/validate");
const pagination = require("../utils/pagination");
const redis = require("../config/redis");

const register = async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin or school can create school staff",
      });
    }

    const { school_id, name, email, password, role } = req.body;
    const requiredFields = { school_id, name, email, password, role };

    for (let i in requiredFields) {
      if (!requiredFields[i]) {
        return res.status(400).json({
          success: false,
          message: `${i.charAt(0).toUpperCase() + i.slice(1)} is required`,
        });
      }
    }

    if (req.user.role === "school") {
      const schoolCheck = await pool.query(
        "SELECT id FROM School WHERE id = $1",
        [req.user.id]
      );
      if (
        schoolCheck.rows.length === 0 ||
        schoolCheck.rows[0].id !== school_id
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied: cannot register staff for another school",
        });
      }
    }

    const roleCheck = await pool.query(
      "SELECT * FROM RolePermission WHERE role = $1",
      [role]
    );
    if (roleCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid role: this role ID does not exist",
      });
    }

    const existing = await pool.query(
      "SELECT * FROM SchoolStaff WHERE email = $1",
      [email]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "A staff member with this email already exists",
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Weak password. Must contain at least 8 characters, one uppercase letter, one number, and one special symbol.",
      });
    }

    const passwordHashed = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO SchoolStaff (school_id, name, email, password, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [school_id, name, email, passwordHashed, role]
    );

    return res.status(201).json({
      success: true,
      message: "School staff member created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating school staff:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    if (!password)
      return res
        .status(400)
        .json({ success: false, message: "Password is required" });

    const existSchoolStaff = await pool.query(
      "SELECT * FROM SchoolStaff WHERE email = $1",
      [email]
    );

    if (existSchoolStaff.rows.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email or password (email)" });
    }

    const staff = existSchoolStaff.rows[0];
    const isPasswordValid = await bcrypt.compare(password, staff.password);

    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password (password)",
      });
    }

    const token = jwt.sign(
      { id: staff.id, role: "schoolStaff" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
    });
  } catch (error) {
    console.error("Error occurred during login:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const logout = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token is required for logout",
      });
    }

    const decoded = jwt.decode(token);
    if (!decoded) {
      return res.status(400).json({
        success: false,
        message: "Invalid token",
      });
    }
    await pool.query(
      "INSERT INTO BlackList (token, expired_at) VALUES ($1, $2)",
      [token, new Date(decoded.exp * 1000)]
    );

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Error occurred during logout:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getSchoolStaffById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can view school staff",
      });
    }

    const id = req.params.id;

    const result = await pool.query(`SELECT * FROM SchoolStaff WHERE id = $1`, [
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "School staff member not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching school staff:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAllSchoolStaff = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can view staff list",
      });
    }

    const { page, limit, skip } = pagination(req);
    const cacheKey = `schoolStaff:${page}:${limit}`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({ cachedData: JSON.parse(cachedData) });
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM SchoolStaff`);
    const totalRecords = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalRecords / limit);

    const result = await pool.query(
      `SELECT * FROM SchoolStaff ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, skip]
    );

    const responseData = {
      success: true,
      page: page,
      limit: limit,
      totalPages: totalPages,
      data: result.rows,
    };
    console.log("Saving data to cache");
    await redis.set(cacheKey, JSON.stringify(responseData));
    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching school staff list:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updateSchoolStaffById = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "schoolStaff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school, or schoolStaff can update school staff",
      });
    }

    const id = req.params.id;
    const allowedFields = ["name", "email", "password"];
    const updates = req.body;

    const keys = Object.keys(updates).filter((key) =>
      allowedFields.includes(key)
    );

    if (keys.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    if (updates.email) {
      if (!validateEmail(updates.email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }

      const emailExists = await pool.query(
        `SELECT id FROM SchoolStaff WHERE email = $1 AND id != $2`,
        [updates.email, id]
      );

      if (emailExists.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Email already in use by another staff member",
        });
      }
    }

    if (updates.password) {
      if (!validatePassword(updates.password)) {
        return res.status(400).json({
          success: false,
          message:
            "Weak password. Must contain at least 8 characters, one uppercase letter, one number, and one special symbol.",
        });
      }

      updates.password = await bcrypt.hash(updates.password, 10);
    }

    const setClause = keys
      .map((key, index) => `${key} = $${index + 1}`)
      .join(", ");
    const values = keys.map((key) => updates[key]);
    values.push(id);

    const result = await pool.query(
      `UPDATE SchoolStaff
       SET ${setClause}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "School staff member not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "School staff updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating school staff:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteSchoolStaffById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can delete staff",
      });
    }

    const id = req.params.id;

    const result = await pool.query(
      `DELETE FROM SchoolStaff WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "School staff member not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "School staff member deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting school staff:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteAllSchoolStaff = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can delete all staff",
      });
    }

    const result = await pool.query(`DELETE FROM SchoolStaff RETURNING *`);

    return res.status(200).json({
      success: true,
      message: "All school staff members deleted",
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Error deleting all school staff:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  getSchoolStaffById,
  getAllSchoolStaff,
  updateSchoolStaffById,
  deleteSchoolStaffById,
  deleteAllSchoolStaff,
};
