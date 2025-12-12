const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { validateEmail, validatePassword } = require("../utils/validate");
const checkLimit = require("../utils/checkLimit");

/**
 * @route   POST /api/v1/school-staff
 * @access  Admin or School
 * @description
 * Registers a new school staff member. Only users with the "admin" role or
 * the "school" role (for their own school) can perform this action.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user object containing role and id
 * @param {Object} req.body - Request body
 * @param {string} req.body.school_id - ID of the school the staff belongs to
 * @param {string} req.body.name - Name of the staff member
 * @param {string} req.body.email - Email of the staff member
 * @param {string} req.body.password - Password for the staff member
 * @param {string} req.body.role - Role ID for the staff member
 *
 * @returns {201} Success - School staff member created
 * @returns {boolean} 201.success - Indicates success
 * @returns {string} 201.message - Success message
 * @returns {Object} 201.data - Created school staff record
 *
 * @throws {400} If any required field is missing or invalid
 * @throws {400} If the school_id or role does not exist
 * @throws {400} If the email is already used by another staff member
 * @throws {400} If the school has reached its staff limit based on plan
 * @throws {403} If a "school" user tries to create staff for another school
 * @throws {403} If a non-admin/non-school user tries to create staff
 * @throws {500} Internal server error for unexpected issues
 *
 * @example
 * Response:
 * {
 *   "success": true,
 *   "message": "School staff member created successfully",
 *   "data": {
 *     "id": "uuid1",
 *     "school_id": "school_uuid",
 *     "name": "John Doe",
 *     "email": "johndoe@example.com",
 *     "role": "role_uuid",
 *     "created_at": "2025-12-12T10:00:00Z",
 *     "updated_at": "2025-12-12T10:00:00Z"
 *   }
 * }
 */

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

    const schoolCheck = await pool.query(
      "SELECT id FROM School WHERE id = $1",
      [school_id]
    );
    if (schoolCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid school_id: school does not exist",
      });
    }

    if (req.user.role === "school" && req.user.id !== school_id) {
      return res.status(403).json({
        success: false,
        message: "Access denied: cannot register staff for another school",
      });
    }

    const roleCheck = await pool.query("SELECT id FROM Role WHERE id = $1", [
      role,
    ]);
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
      return res
        .status(400)
        .json({ success: false, message: "Invalid email format" });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Weak password. Must contain at least 8 characters, one uppercase letter, one number, and one special symbol.",
      });
    }

    const isLimitReached = await checkLimit(school_id, "schoolstaff");

    if (isLimitReached) {
      return res.status(400).json({
        success: false,
        message: "School staff limit reached for this plan",
      });
    }

    await pool.query(
      `
  UPDATE SchoolUsage
  SET schoolStaff_count = schoolStaff_count + 1,
      updated_at = CURRENT_TIMESTAMP
  WHERE school_id = $1
`,
      [school_id]
    );

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

/**
 * @route   POST /api/v1/school-staff/login
 * @access  Public
 * @description
 * Authenticates a school staff member using email and password, returning a JWT token
 * if successful.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - Email of the staff member
 * @param {string} req.body.password - Password of the staff member
 *
 * @returns {200} Success - Staff authenticated successfully
 * @returns {boolean} 200.success - Indicates success
 * @returns {string} 200.message - Success message
 * @returns {string} 200.token - JWT token valid for 1 hour
 *
 * @throws {400} If email or password is missing
 * @throws {400} If the email does not exist in the system
 * @throws {400} If the password is invalid
 * @throws {500} Internal server error for unexpected issues
 *
 * @example
 * Response:
 * {
 *   "success": true,
 *   "message": "Login successful",
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 *
 * @example
 * Error Response (invalid credentials):
 * {
 *   "success": false,
 *   "message": "Invalid email or password (email/password)"
 * }
 */

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

/**
 * @route   POST /api/v1/school-staff/logout
 * @access  Private (SchoolStaff)
 * @description
 * Logs out a school staff member by blacklisting their JWT token, preventing further use
 * until it expires.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.headers - Request headers
 * @param {string} req.headers.authorization - Authorization header with Bearer token
 *
 * @returns {200} Success - Logout successful
 * @returns {boolean} 200.success - Indicates success
 * @returns {string} 200.message - Logout confirmation message
 *
 * @throws {400} If token is missing in headers
 * @throws {400} If token is invalid or cannot be decoded
 * @throws {500} Internal server error for unexpected issues
 *
 * @example
 * Response:
 * {
 *   "success": true,
 *   "message": "Logout successful"
 * }
 *
 * @example
 * Error Response (missing token):
 * {
 *   "success": false,
 *   "message": "Token is required for logout"
 * }
 */

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

module.exports = {
  register,
  login,
  logout,
};
