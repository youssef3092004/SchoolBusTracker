const pool = require("../config/db");
const bcrypt = require("bcrypt");
const pagination = require("../utils/pagination");
const redis = require("../config/redis");

/**
 * @route   GET /api/v1/school-staff/:id
 * @access  Private (Admin or School)
 * @description
 * Fetch a specific school staff member by their ID. Only users with "admin" or the
 * associated "school" role can access this endpoint.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request URL parameters
 * @param {string} req.params.id - ID of the school staff member to fetch
 * @param {Object} req.user - Authenticated user info from JWT middleware
 * @param {string} req.user.role - Role of the authenticated user ("admin", "school", etc.)
 *
 * @returns {200} Success - Returns the staff member data
 * @returns {boolean} 200.success - Indicates success
 * @returns {Object} 200.data - School staff record
 *
 * @throws {403} Access denied if user is neither "admin" nor "school"
 * @throws {404} If no school staff member is found for the given ID
 * @throws {500} Internal server error for unexpected issues
 *
 * @example
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid",
 *     "school_id": "school_uuid",
 *     "name": "John Doe",
 *     "email": "john@example.com",
 *     "role": "teacher",
 *     "created_at": "2025-12-12T10:00:00Z",
 *     "updated_at": "2025-12-12T10:00:00Z"
 *   }
 * }
 */

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

/**
 * @route   GET /api/v1/school-staff
 * @access  Private (Admin or School)
 * @description
 * Fetch all school staff members with pagination support. Only users with "admin"
 * or "school" roles can access this endpoint. Uses Redis caching to improve performance.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters for pagination
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of records per page
 * @param {Object} req.user - Authenticated user info from JWT middleware
 * @param {string} req.user.role - Role of the authenticated user ("admin", "school", etc.)
 *
 * @returns {200} Success - Returns paginated list of school staff
 * @returns {boolean} 200.success - Indicates success
 * @returns {number} 200.page - Current page number
 * @returns {number} 200.limit - Number of records per page
 * @returns {number} 200.totalPages - Total number of pages
 * @returns {Array} 200.data - Array of school staff records
 *
 * @throws {403} Access denied if user is neither "admin" nor "school"
 * @throws {500} Internal server error for unexpected issues
 *
 * @example
 * Response:
 * {
 *   "success": true,
 *   "page": 1,
 *   "limit": 10,
 *   "totalPages": 5,
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "school_id": "school_uuid",
 *       "name": "John Doe",
 *       "email": "john@example.com",
 *       "role": "teacher",
 *       "created_at": "2025-12-12T10:00:00Z",
 *       "updated_at": "2025-12-12T10:00:00Z"
 *     },
 *     ...
 *   ]
 * }
 */

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

/**
 * @route   PATCH /api/v1/school-staff/:id
 * @access  Private (Admin, School, or SchoolStaff)
 * @description
 * Update a school staff member's details by ID. Only users with roles "admin",
 * "school", or the staff member themselves can perform this action.
 * Valid fields for update: name, email, password.
 *
 * @param {Object} req - Express request object
 * @param {string} req.params.id - ID of the school staff member to update
 * @param {Object} req.body - Fields to update
 * @param {string} [req.body.name] - New name of the staff member
 * @param {string} [req.body.email] - New email (must be unique and valid)
 * @param {string} [req.body.password] - New password (must meet complexity requirements)
 * @param {Object} req.user - Authenticated user info from JWT middleware
 * @param {string} req.user.role - Role of the authenticated user
 *
 * @returns {200} Success - Returns updated school staff member
 * @returns {boolean} 200.success - Indicates success
 * @returns {string} 200.message - Success message
 * @returns {Object} 200.data - Updated school staff record
 *
 * @throws {400} Bad request if no valid fields are provided or invalid email/password
 * @throws {403} Access denied if user is not admin, school, or the staff member
 * @throws {404} Staff member not found
 * @throws {500} Internal server error for unexpected issues
 *
 * @example
 * Response:
 * {
 *   "success": true,
 *   "message": "School staff updated successfully",
 *   "data": {
 *     "id": "uuid",
 *     "school_id": "school_uuid",
 *     "name": "Jane Doe",
 *     "email": "jane@example.com",
 *     "role": "teacher",
 *     "created_at": "2025-12-12T10:00:00Z",
 *     "updated_at": "2025-12-12T12:00:00Z"
 *   }
 * }
 */

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

/**
 * @route   DELETE /api/v1/school-staff/:id
 * @access  Private (Admin or School)
 * @description
 * Delete a school staff member by ID. Only users with roles "admin" or "school"
 * can perform this action. Also decrements the schoolStaff_count in SchoolUsage.
 *
 * @param {Object} req - Express request object
 * @param {string} req.params.id - ID of the school staff member to delete
 * @param {Object} req.user - Authenticated user info from JWT middleware
 * @param {string} req.user.role - Role of the authenticated user
 *
 * @returns {200} Success - Returns success message
 * @returns {boolean} 200.success - Indicates success
 * @returns {string} 200.message - Success message
 *
 * @throws {403} Access denied if user is not admin or school
 * @throws {404} Staff member not found
 * @throws {500} Internal server error for unexpected issues
 *
 * @example
 * Response:
 * {
 *   "success": true,
 *   "message": "School staff member deleted successfully"
 * }
 */

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

    await pool.query(
      `
  UPDATE SchoolUsage
  SET schoolStaff_count = schoolStaff_count - 1,
      updated_at = CURRENT_TIMESTAMP
  WHERE school_id = $1
`,
      [school_id]
    );

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

/**
 * @route   DELETE /api/v1/school-staff/all/:school_id
 * @access  Private (Admin or School)
 * @description
 * Delete all school staff members for a specific school. Only users with roles
 * "admin" or "school" can perform this action. Resets the schoolStaff_count in SchoolUsage.
 *
 * @param {Object} req - Express request object
 * @param {string} req.params.school_id - ID of the school for which all staff will be deleted
 * @param {Object} req.user - Authenticated user info from JWT middleware
 * @param {string} req.user.role - Role of the authenticated user
 *
 * @returns {200} Success - Returns success message and count of deleted staff
 * @returns {boolean} 200.success - Indicates success
 * @returns {string} 200.message - Success message
 * @returns {number} 200.count - Number of staff members deleted
 *
 * @throws {403} Access denied if user is not admin or school
 * @throws {500} Internal server error for unexpected issues
 *
 * @example
 * Response:
 * {
 *   "success": true,
 *   "message": "All school staff members deleted",
 *   "count": 15
 * }
 */

const deleteAllSchoolStaff = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can delete all staff",
      });
    }

    const { school_id } = req.params;

    const result = await pool.query(
      `DELETE FROM SchoolStaff WHERE school_id = $1 RETURNING *`,
      [school_id]
    );

    await pool.query(
      `
  UPDATE SchoolUsage
  SET schoolStaff_count = 0,
      updated_at = CURRENT_TIMESTAMP
  WHERE school_id = $1
`,
      [school_id]
    );

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
