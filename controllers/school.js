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

const registerSchool = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can register a school",
      });
    }

    const { name, address, phone, email, governorate, password } = req.body;
    requiredFields = { name, address, phone, email, governorate, password };
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

    const existSchool = await pool.query(
      "SELECT * FROM School WHERE email = $1",
      [email]
    );
    if (existSchool.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email already in use",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newSchool = await pool.query(
      `INSERT INTO School (name, address, phone, email, governorate, password)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, address, phone, email, governorate, hashedPassword]
    );

    return res.status(201).json({
      success: true,
      message: "School registered successfully",
      school: newSchool.rows[0],
    });
  } catch (error) {
    console.error("Error occurred during registration:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const loginSchool = async (req, res, next) => {
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

    const existSchool = await pool.query(
      "SELECT * FROM School WHERE email = $1",
      [email]
    );

    if (existSchool.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }
    const school = existSchool.rows[0];

    const isPasswordValid = await bcrypt.compare(password, school.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { id: school.id, role: "school" },
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

const logoutSchool = async (req, res, next) => {
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

const updateSchool = async (req, res, next) => {
  try {
    if (req.user.role !== "school" && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const schoolId = req.user.id;
    const allowedFields = [
      "name",
      "address",
      "phone",
      "email",
      "governorate",
      "password",
    ];
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

    values.push(schoolId);

    const query = `
      UPDATE School
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING id, name, address, phone, email, governorate, updated_at;
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "School not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "School updated successfully",
      school: result.rows[0],
    });
  } catch (error) {
    console.error("Error occurred during school update:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getSchoolById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can view school",
      });
    }

    const schoolId = req.params.id;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID is required",
      });
    }

    const result = await pool.query(
      `SELECT id, name, address, phone, email, governorate, created_at, updated_at
       FROM School
       WHERE id = $1`,
      [schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "School not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "School fetched successfully",
      school: result.rows[0],
    });
  } catch (error) {
    console.error("Error occurred during fetching school:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAllSchools = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can view all schools",
      });
    }

    const { page, limit, skip } = pagination(req);

    const cacheKey = `schools:${page}:${limit}`;
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      console.log("Returning data from Redis cache");
      return res.status(200).json(JSON.parse(cachedData));
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM School`
    );
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    const result = await pool.query(
      `SELECT id, name, address, phone, email, governorate, created_at, updated_at
       FROM School
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, skip]
    );

    const responseData = {
      success: true,
      page: page,
      limit: limit,
      totalPages: totalPages,
      data: result.rows,
    };
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(responseData));

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error occurred during fetching schools:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteSchoolById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can delete school",
      });
    }

    const schoolId = req.params.id;

    const result = await pool.query("DELETE FROM School WHERE id = $1", [
      schoolId,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "School not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "School deleted successfully",
    });
  } catch (error) {
    console.error("Error occurred during deleting school:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteAllSchools = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can delete all schools",
      });
    }

    await pool.query("DELETE FROM School");

    return res.status(200).json({
      success: true,
      message: "All schools deleted successfully",
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Error occurred during deleting all schools:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  registerSchool,
  loginSchool,
  logoutSchool,
  updateSchool,
  getSchoolById,
  getAllSchools,
  deleteSchoolById,
  deleteAllSchools,
};
