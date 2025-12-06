const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  validateEmail,
  validatePassword,
  validatePhone,
} = require("../utils/validate");
const redis = require("../config/redis");

/**
 * @route POST /api/v1/admin/register
 * @desc Register a new admin in the system. Only accessible by existing admins.
 * @access Admin (requires JWT token with role: "admin")
 * @throws {403} If the requester is not an admin.
 * @throws {400} If required fields are missing, email is invalid, password is weak,
 *               phone is invalid, or email already exists.
 * @throws {500} If an unexpected server or database error occurs.
 * @returns {Object} A JSON object containing the newly created admin's data and a success message.
 *
 * This route handler allows an existing admin to create another admin account. It performs the following steps:
 * 1. Checks if the requester has admin privileges.
 * 2. Validates that all required fields (name, phone, email, password) are provided.
 * 3. Validates email format, password strength, and phone number format.
 * 4. Checks if the email already exists in the database to prevent duplicates.
 * 5. Hashes the password using bcrypt before storing it.
 * 6. Inserts the new admin into the "Admin" table.
 * 7. Clears any cached admin data in Redis to ensure subsequent queries return fresh data.
 * 8. Returns a 201 status with the newly created admin data.
 *
 * Example response:
 * {
 *   "success": true,
 *   "message": "Admin registered successfully",
 *   "admin": {
 *     "id": "uuid-generated-id",
 *     "name": "Youssef Ahmed",
 *     "phone": "+201234567890",
 *     "email": "youssef@example.com",
 *     "password": "hashed_password",
 *     "created_at": "2025-12-06T12:00:00.000Z",
 *     "updated_at": "2025-12-06T12:00:00.000Z"
 *   }
 * }
 */

const registerAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can update an admin",
      });
    }
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
    const keysRids = await redis.keys("admins:*");
    if (keysRids.length > 0) {
      await redis.del(keysRids);
    }
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

/**
 * @route POST /api/v1/admin/login
 * @desc Authenticate an admin using email and password, verify credentials,
 *       and return a signed JWT token for secure access to protected routes.
 * @access Public
 *
 * @bodyParam {string} email - The admin’s registered email address. Required.
 * @bodyParam {string} password - The admin’s account password. Required.
 *
 * @returns {Object} 200 - Success response with JWT token
 * @returns {boolean} success - Indicates whether the operation was successful
 * @returns {string} message - Describes the result of the login process
 * @returns {string} token - JWT token that grants access to admin-only endpoints
 *
 * @throws {400} If the email or password is missing
 * @throws {400} If the email does not exist or the password is incorrect
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint handles admin authentication.
 * The provided email is checked against the database, and the password is validated
 * using bcrypt to ensure secure comparison. If the credentials are correct,
 * a JWT token is generated containing the admin’s ID, email, and role.
 * This token must be included in the Authorization header for all protected admin routes.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Admin logged in successfully",
 *   "token": "jwt_token_here"
 * }
 */

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
/**
 * @route POST /api/v1/admin/logout
 * @desc Log out an authenticated admin by invalidating the current JWT token.
 *       The token is added to the blacklist to prevent further access until it expires.
 * @access Private (Admin)
 *
 * @header Authorization - Bearer token used during the session. Required.
 *
 * @returns {Object} 200 - Success response confirming logout
 * @returns {boolean} success - Indicates whether the logout was processed
 * @returns {string} message - Description of the logout result
 *
 * @throws {400} If the Authorization header is missing
 * @throws {400} If the token is missing or invalid
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint invalidates the currently active JWT token by storing it inside
 * the `BlackList` database table. Once blacklisted, the token cannot be used to
 * access protected routes even if it has not yet expired.
 *
 * Steps performed:
 * 1. Validate the presence of the Authorization header.
 * 2. Extract and decode the JWT token.
 * 3. Store the token and its expiration time in the `BlackList` table.
 * 4. Return a success response confirming the logout action.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Logout successfully"
 * }
 */

const logoutAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

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

module.exports = {
  registerAdmin,
  loginAdmin,
  logoutAdmin,
};
