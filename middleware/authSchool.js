const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  validateEmail,
  validatePassword,
  validatePhone,
} = require("../utils/validate");

/**
 * @route POST /api/v1/schools/register
 * @desc Register a new school under a specific plan. Only admins are allowed to perform this action.
 * @access Private (Admin)
 *
 * @param {string} plan_id - The ID of the plan the school will subscribe to
 * @param {string} name - School name
 * @param {string} address - School address
 * @param {string} phone - School phone number
 * @param {string} email - School email address
 * @param {string} governorate - Governorate where the school is located
 * @param {string} password - Password for the school admin account
 *
 * @returns {Object} 201 - Successfully created school
 * @returns {boolean} success - Indicates successful registration
 * @returns {string} message - Description of the result
 * @returns {Object} school - Newly created school record
 *
 * @throws {400} If any required field is missing
 * @throws {400} If email, phone, or password formats are invalid
 * @throws {400} If the email is already in use
 * @throws {403} If the requesting user is not an admin
 * @throws {404} If the provided plan does not exist
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint registers a new school under a chosen plan. It performs:
 * 1. Admin authorization check.
 * 2. Validation for all required fields: `plan_id`, `name`, `address`, `phone`, `email`, `governorate`, `password`.
 * 3. Validation of email format, password strength, and phone number.
 * 4. Check for duplicate email in the `School` table.
 * 5. Verify that the provided `plan_id` exists.
 * 6. Hash the school admin password.
 * 7. Insert the new school into the `School` table.
 * 8. Create an initial `SchoolUsage` record for usage tracking.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "School registered successfully",
 *   "school": {
 *     "id": "uuid",
 *     "plan_id": "uuid",
 *     "name": "ABC International",
 *     "email": "info@abc.com",
 *     ...
 *   }
 * }
 *
 * Example error response (duplicate email):
 * {
 *   "success": false,
 *   "message": "Email already in use"
 * }
 */

const registerSchool = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can register a school",
      });
    }

    const { plan_id, name, address, phone, email, governorate, password } =
      req.body;
    requiredFields = {
      plan_id,
      name,
      address,
      phone,
      email,
      governorate,
      password,
    };
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

    const existPlan = await pool.query("SELECT * FROM Plan WHERE id = $1", [
      plan_id,
    ]);

    if (existPlan.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Plan not found. Please verify the plan ID.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newSchool = await pool.query(
      `INSERT INTO School (plan_id, name, address, phone, email, governorate, password)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [plan_id, name, address, phone, email, governorate, hashedPassword]
    );

    const createSchoolUsage = await pool.query(
      `INSERT INTO SchoolUsage (school_id) VALUES ($1)`,
      [newSchool.rows[0].id]
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

/**
 * @route POST /api/v1/schools/login
 * @desc Authenticate a school using email and password, and return a JWT token upon successful login.
 * @access Public
 *
 * @param {string} email - School account email
 * @param {string} password - School account password
 *
 * @returns {Object} 200 - Successful login response
 * @returns {boolean} success - Indicates whether login was successful
 * @returns {string} message - Success message
 * @returns {string} token - JWT token for authentication
 *
 * @throws {400} If email or password is missing
 * @throws {400} If the email does not exist or password is incorrect
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint allows a school to log in using their email and password.
 * It performs the following steps:
 *
 * 1. Validate that both `email` and `password` are provided.
 * 2. Check if a school exists with the provided email.
 * 3. Compare the provided password with the stored hashed password using bcrypt.
 * 4. If valid, generate a JWT token containing:
 *    - `id`: School ID
 *    - `role`: "school"
 *    The token expires in 1 hour.
 * 5. Return the token in the response.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Login successful",
 *   "token": "jwt.token.here"
 * }
 *
 * Example error response (invalid credentials):
 * {
 *   "success": false,
 *   "message": "Invalid email or password"
 * }
 */

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
/**
 * @route POST /api/v1/schools/logout
 * @desc Logs out a school by blacklisting the current JWT token.
 *       Once blacklisted, the token cannot be used again for authentication.
 * @access Private (School)
 *
 * @header Authorization - Bearer <token>
 *
 * @returns {Object} 200 - Successfully logged out
 * @returns {boolean} success - Indicates successful logout
 * @returns {string} message - Logout status message
 *
 * @throws {400} If the token is missing or invalid
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint invalidates the currently used JWT token by adding it to the `BlackList` table.
 * It performs the following steps:
 *
 * 1. Extract the token from the `Authorization` header.
 * 2. Validate that a token exists and is properly formatted.
 * 3. Decode the token to extract its expiration time (`exp`).
 * 4. Insert the token into the `BlackList` table with its expiration timestamp.
 *    - After this, any request using this token will be rejected by the auth middleware.
 * 5. Respond with a success message.
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

module.exports = {
  registerSchool,
  loginSchool,
  logoutSchool,
};
