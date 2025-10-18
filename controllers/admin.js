const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  validateEmail,
  validatePassword,
  validatePhone,
} = require("../utils/validate");
const pagination = require("../utils/pagination");
const redisClient = require("../config/redis");

//! fix the first admin registration without token verification
const registerAdmin = async (req, res, next) => {
  try {
    // if (!req.user.role === "admin") {
    //   return res.status(403).json({
    //     success: false,
    //     message: "Access denied: only admin can register a admin",
    //   });
    // }
    const { name, phone, email, password } = req.body;
    const requiredFields = { name, phone, email, password };

    for (let i in requiredFields) {
      if (!requiredFields[i]) {
        return res.status(400).json({
          success: false,
          message: `${i.charAt(0).toUpperCase() + i.slice(1)} is required`,
        });
      }
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
    if (!validatePhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format",
      });
    }

    const existAdmin = await pool.query(
      "SELECT * FROM Admin WHERE email = $1",
      [email]
    );
    if (existAdmin.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email already in use",
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = await pool.query(
      `INSERT INTO Admin (name, phone, email, password)
             VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, phone, email, hashedPassword]
    );
    return res.status(201).json({
      success: true,
      message: "Admin registered successfully",
      admin: newAdmin.rows[0],
    });
  } catch (error) {
    console.error("Error registering admin:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const loginAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    const existAdmin = await pool.query(
      "SELECT * FROM Admin WHERE email = $1",
      [email]
    );

    if (existAdmin.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const admin = existAdmin.rows[0];
    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    return res.status(200).json({
      success: true,
      message: "Admin logged in successfully",
      token: token,
    });
  } catch (error) {
    console.error("Error logging in admin:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const logoutAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization; // ✅ correct way

    if (!authHeader) {
      return res.status(400).json({
        success: false,
        message: "No authorization header provided",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "No token provided",
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
      message: "Logout successfully",
    });
  } catch (error) {
    console.error("Error logging out admin:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//! fix when admin rewrite the email or password
const updateAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can update supervisor details",
      });
    }

    const adminId = req.user.id;

    const allowedFields = ["name", "phone", "email", "password"];
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
    const setClause = keys
      .map((key, index) => `${key} = $${index + 1}`)
      .join(", ");

    const values = keys.map((key) => updates[key]);

    values.push(adminId);

    const query = `
      UPDATE Admin
      SET ${setClause}
      WHERE id = $${values.length}
      RETURNING id, name, phone, email, updated_at;
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Admin updated successfully",
      admin: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating admin:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAdminById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can get admin details",
      });
    }

    const adminId = req.params.id;

    const result = await pool.query(
      "SELECT id, name, phone, email, created_at, updated_at FROM Admin WHERE id = $1",
      [adminId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Admin details fetched successfully",
      admin: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching admin details:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAllAdmins = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can view admins list",
      });
    }

    const { page, limit, skip } = pagination(req);

    const cacheKey = `admins:page=${page}:limit=${limit}`;
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      console.log("Returning data from Redis cache");
      return res.status(200).json(JSON.parse(cachedData));
    }

    const countResult = await pool.query("SELECT COUNT(*) AS total FROM Admin");
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    const result = await pool.query(
      `SELECT id, name, phone, email, created_at, updated_at
       FROM Admin
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, skip]
    );

    const responseData = {
      success: true,
      page,
      limit,
      total,
      totalPages,
      data: result.rows,
    };
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(responseData));
    console.log("Data saved in Redis cache");

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching admins list:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteAdminById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can delete an admin",
      });
    }

    const adminId = req.params.id;

    const result = await pool.query("DELETE FROM Admin WHERE id = $1", [
      adminId,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Admin deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting admin:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteAllAdmins = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can delete all admins",
      });
    }

    const result = await pool.query("DELETE FROM Admin");

    return res.status(200).json({
      success: true,
      message: "All admins deleted successfully",
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Error deleting all admins:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  registerAdmin,
  loginAdmin,
  logoutAdmin,
  updateAdmin,
  getAdminById,
  getAllAdmins,
  deleteAdminById,
  deleteAllAdmins,
};
