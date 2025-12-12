const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pagination = require("../utils/pagination");
const redisClient = require("../config/redis");

/**
 * @route PATCH /api/v1/schools/update
 * @desc Update school information. Accessible by the school itself or an admin.
 * @access Private (School, Admin)
 *
 * @body {string} [plan_id] - Updated plan ID assigned to the school
 * @body {string} [name] - Updated school name
 * @body {string} [address] - Updated address
 * @body {string} [phone] - Updated phone number
 * @body {string} [email] - Updated email address
 * @body {string} [governorate] - Updated governorate
 * @body {string} [password] - Updated password
 *
 * @returns {Object} 200 - Successful update response
 * @returns {boolean} success - Indicates update success
 * @returns {string} message - Description of the update result
 * @returns {Object} school - Updated school data
 *
 * @throws {400} If no valid fields are provided for update
 * @throws {403} If the user is neither a school nor an admin
 * @throws {404} If the school is not found
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint updates school details. The authenticated school can update their own
 * information, and admins can also update any school using the same request.
 *
 * Steps performed:
 * 1. Verify the user role (`school` or `admin`).
 * 2. Determine which fields from the request body are allowed (`allowedFields`).
 * 3. Build a dynamic SQL update query using only the allowed fields provided.
 * 4. Apply the update and return the updated school record.
 * 5. Automatically update the `updated_at` timestamp.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "School updated successfully",
 *   "school": {
 *     "id": "uuid",
 *     "name": "New Name",
 *     "address": "New Address",
 *     "email": "new@mail.com",
 *     "updated_at": "2025-12-12T10:00:00Z"
 *   }
 * }
 *
 * Example error response (no valid fields):
 * {
 *   "success": false,
 *   "message": "No valid fields provided for update"
 * }
 */

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
      "plan_id",
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

/**
 * @route   GET /api/v1/schools/:id
 * @access  Admin Only
 * @description
 * This endpoint retrieves a school by its ID. Only an authenticated admin
 * can access this endpoint. The school ID must be provided as a URL parameter.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.user - The authenticated user object containing role
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - School ID (UUID)
 *
 * @returns {200} Success - Returns the school information
 * @returns {Object} 200.success - Indicates success status
 * @returns {string} 200.message - Success message
 * @returns {Object} 200.school - The school record
 *
 * @throws {403} Access denied if the user is not an admin
 * @throws {400} If school ID is missing
 * @throws {404} If the school is not found
 * @throws {500} Internal server error
 */

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

    const result = await pool.query(`SELECT * FROM School WHERE id = $1`, [
      schoolId,
    ]);

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

/**
 * @route   GET /api/v1/schools
 * @access  Admin Only
 * @description
 * Retrieves a paginated list of all schools. Only an authenticated admin
 * can access this endpoint. The results are cached in Redis for faster
 * subsequent requests.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user object containing role
 * @param {Object} req.query - Query parameters for pagination
 * @param {number} [req.query.page=1] - Page number (optional)
 * @param {number} [req.query.limit=10] - Number of items per page (optional)
 *
 * @returns {200} Success - Returns paginated list of schools
 * @returns {boolean} 200.success - Indicates success status
 * @returns {number} 200.page - Current page number
 * @returns {number} 200.limit - Number of items per page
 * @returns {number} 200.totalPages - Total number of pages
 * @returns {Array<Object>} 200.data - Array of school records
 *
 * @throws {403} Access denied if the user is not an admin
 * @throws {500} Internal server error for unexpected issues
 *
 * @example
 * Response:
 * {
 *   "success": true,
 *   "page": 1,
 *   "limit": 10,
 *   "totalPages": 3,
 *   "data": [
 *     {
 *       "id": "uuid1",
 *       "name": "ABC School",
 *       "address": "123 Main St",
 *       "phone": "0123456789",
 *       "email": "abc@school.com",
 *       "governorate": "Cairo",
 *       "created_at": "2025-12-12T10:00:00Z",
 *       "updated_at": "2025-12-12T10:00:00Z"
 *     }
 *   ]
 * }
 */

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
      `SELECT *FROM School ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
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

/**
 * @route   DELETE /api/v1/schools/:id
 * @access  Admin Only
 * @description
 * Deletes a school by its ID. Only an authenticated admin can perform this action.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user object containing role
 * @param {string} req.params.id - ID of the school to delete
 *
 * @returns {200} Success - School deleted successfully
 * @returns {boolean} 200.success - Indicates success status
 * @returns {string} 200.message - Deletion confirmation message
 *
 * @throws {403} Access denied if the user is not an admin
 * @throws {404} School not found if no school exists with the given ID
 * @throws {500} Internal server error for unexpected issues
 *
 * @example
 * Response:
 * {
 *   "success": true,
 *   "message": "School deleted successfully"
 * }
 *
 * @example
 * Error Response (not found):
 * {
 *   "success": false,
 *   "message": "School not found"
 * }
 */

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

/**
 * @route   DELETE /api/v1/schools
 * @access  Admin Only
 * @description
 * Deletes all schools from the database. Only an authenticated admin can perform this action.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user object containing role
 *
 * @returns {200} Success - All schools deleted successfully
 * @returns {boolean} 200.success - Indicates success status
 * @returns {string} 200.message - Confirmation message
 * @returns {number} 200.count - Number of schools deleted
 *
 * @throws {403} Access denied if the user is not an admin
 * @throws {500} Internal server error for unexpected issues
 *
 * @example
 * Response:
 * {
 *   "success": true,
 *   "message": "All schools deleted successfully",
 *   "count": 15
 * }
 */

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
  updateSchool,
  getSchoolById,
  getAllSchools,
  deleteSchoolById,
  deleteAllSchools,
};
