const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const redis = require("../config/redis");
const checkLimit = require("../utils/checkLimit");

/**
 * @route POST /api/v1/supervisor/register
 * @desc Register a new supervisor under a specific school. Only users with roles
 *       "admin" or "school" are authorized to perform this action.
 *
 * @access Private (Admin, School)
 *
 * @body {string} name - Supervisor's full name (required)
 * @body {string} school_id - ID of the school the supervisor belongs to (required)
 * @body {string} governorate - Supervisor's assigned governorate (required)
 *
 * @returns {Object} 201 - Success response containing supervisor data
 * @returns {boolean} success - Indicates registration result
 * @returns {string} message - Description of the operation result
 * @returns {Object} data - Newly created supervisor information
 *
 * @throws {400} If required fields are missing or plan limit is reached
 * @throws {403} If the requester does not have permission or tries registering for another school
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint allows an authorized user (either an admin or a school account) to register
 * a new supervisor within a school. The process includes several validation and security steps:
 *
 * 1. **Role Validation:**
 *    Ensures the requester is either an "admin" or "school" user.
 *
 * 2. **Input Validation:**
 *    Checks that all required fields (`name`, `school_id`, `governorate`) are provided.
 *
 * 3. **School Ownership Check (if role is school):**
 *    A school account can only register supervisors for its own school ID.
 *
 * 4. **Plan Limit Validation:**
 *    Uses the `checkLimit` function to verify the school has not exceeded its supervisor limit.
 *
 * 5. **Update Usage Count:**
 *    Increments the `supervisors_count` in the **SchoolUsage** table.
 *
 * 6. **Supervisor Creation:**
 *    Inserts a new supervisor into the database with a generated default email and password.
 *
 * 7. **Password Hashing:**
 *    Hashes the auto-generated password before saving it securely.
 *
 * 8. **Cache Invalidation:**
 *    Deletes Redis keys matching `supervisors:*` to ensure fresh data for upcoming requests.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Supervisor registered successfully",
 *   "data": {
 *      "id": "uuid",
 *      "name": "John Doe",
 *      "default_email": "supervisor123@domain.com",
 *      "password": "******",
 *      "created_at": "2025-02-15T10:30:00.000Z"
 *   }
 * }
 *
 * Example error response (limit reached):
 * {
 *   "success": false,
 *   "message": "Supervisor limit reached for this plan"
 * }
 */

const registerSupervisor = async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only school or admin can register a supervisor",
      });
    }

    const { name, school_id, governorate } = req.body;

    const requiredFields = { name, school_id, governorate };
    for (let field in requiredFields) {
      if (!requiredFields[field]) {
        return res.status(400).json({
          success: false,
          message: `${
            field.charAt(0).toUpperCase() + field.slice(1)
          } is required`,
        });
      }
    }

    if (req.user.role === "school") {
      const schoolCheck = await pool.query(
        "SELECT id FROM School WHERE id = $1",
        [req.user.school_id || req.user.id]
      );

      if (
        schoolCheck.rows.length === 0 ||
        schoolCheck.rows[0].id !== school_id
      ) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: cannot register supervisor for another school",
        });
      }
    }

    const isLimitReached = await checkLimit(school_id, "supervisor");

    if (isLimitReached) {
      return res.status(400).json({
        success: false,
        message: "Supervisor limit reached for this plan",
      });
    }
    await pool.query(
      `
      UPDATE SchoolUsage
      SET supervisors_count = supervisors_count + 1
      WHERE school_id = $1
    `,
      [school_id]
    );

    const inserted = await pool.query(
      `
      INSERT INTO Supervisor (name, school_id, governorate)
      VALUES ($1, $2, $3)
      RETURNING id, name, default_email, password, created_at;
      `,
      [name, school_id, governorate]
    );

    const supervisor = inserted.rows[0];

    const hashedPassword = await bcrypt.hash(supervisor.password, 10);

    await pool.query(`UPDATE Supervisor SET password = $1 WHERE id = $2`, [
      hashedPassword,
      supervisor.id,
    ]);

    const keys = await redis.keys("supervisors:*");
    if (keys.length > 0) {
      await redis.del(keys);
      console.log("Cleared supervisors cache after new registration");
    }

    return res.status(201).json({
      success: true,
      message: "Supervisor registered successfully",
      data: supervisor,
    });
  } catch (error) {
    console.error("Error registering supervisor:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route POST /api/v1/supervisor/login
 * @desc Authenticate a supervisor using their email and password.
 *       Upon successful login, a JWT token is issued for authenticated requests.
 *
 * @access Public
 *
 * @body {string} email - Supervisor's login email (required)
 * @body {string} password - Supervisor's account password (required)
 *
 * @returns {Object} 200 - Success response with JWT token
 * @returns {boolean} success - Indicates whether login was successful
 * @returns {string} message - Description of the login result
 * @returns {string} token - JWT authentication token (valid for 1 hour)
 *
 * @throws {400} If email or password is missing
 * @throws {400} If the provided email or password is invalid
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint allows a supervisor to authenticate using their default email and password.
 * Once verified, a secure JWT token is returned, enabling the supervisor to access
 * protected routes. The process follows these steps:
 *
 * 1. **Input Validation:**
 *    Ensures that both `email` and `password` are provided in the request body.
 *
 * 2. **Supervisor Lookup:**
 *    Searches the database for a supervisor whose `default_email` matches the provided email.
 *    Returns an error if no matching record is found.
 *
 * 3. **Password Verification:**
 *    Compares the raw password entered by the supervisor with the hashed password stored
 *    in the database. If the comparison fails, the login attempt is rejected.
 *
 * 4. **JWT Generation:**
 *    Creates a signed JWT containing:
 *      - `id`: Supervisor ID
 *      - `role`: "supervisor"
 *    The token expires in **1 hour** for security purposes.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Login successful",
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 *
 * Example error response (invalid credentials):
 * {
 *   "success": false,
 *   "message": "Invalid email or password"
 * }
 */

const loginSupervisor = async (req, res, next) => {
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

    const existSupervisor = await pool.query(
      "SELECT * FROM Supervisor WHERE default_email = $1",
      [email]
    );

    if (existSupervisor.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const supervisor = existSupervisor.rows[0];

    const isPasswordValid = await bcrypt.compare(password, supervisor.password);
    if (!isPasswordValid) {
      console.log("Invalid password attempt for supervisor:", email);
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        id: supervisor.id,
        role: "supervisor",
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: token,
    });
  } catch (error) {
    console.error("Error during supervisor login:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route POST /api/v1/supervisor/logout
 * @desc Logs out a supervisor by blacklisting their current JWT token.
 *       After logout, the token becomes invalid for all future authenticated requests.
 *
 * @access Private (Supervisor)
 *
 * @header {string} Authorization - Must include a valid JWT token in the format: "Bearer <token>"
 *
 * @returns {Object} 200 - Success response confirming logout
 * @returns {boolean} success - Indicates whether logout was successful
 * @returns {string} message - Description of the logout result
 *
 * @throws {400} If the token is missing or invalid
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint allows a logged-in supervisor to securely log out by invalidating
 * their current JWT token. Instead of deleting the token on the client side only,
 * the system implements server-side token invalidation using a blacklist table.
 * This ensures that even if the JWT is stolen, it cannot be reused after logout.
 *
 * The logout process includes:
 *
 * 1. **Token Extraction:**
 *    Reads the token from the `Authorization` header. It must be in the format
 *    `"Bearer <token>"`. If missing, an error is returned.
 *
 * 2. **Token Decoding:**
 *    The token is decoded (without verifying signature) to extract the expiration timestamp.
 *    If decoding fails, the token is considered invalid.
 *
 * 3. **Token Blacklisting:**
 *    The token is inserted into the `BlackList` table along with its expiration time.
 *    Middleware that checks authentication will prevent any blacklisted token from being used.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Logout successful"
 * }
 *
 * Example error response (missing token):
 * {
 *   "success": false,
 *   "message": "Token is required for logout"
 * }
 */

const logoutSupervisor = async (req, res, next) => {
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
  registerSupervisor,
  loginSupervisor,
  logoutSupervisor,
};
