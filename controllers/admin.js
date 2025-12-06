const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  validateEmail,
  validatePassword,
  validatePhone,
} = require("../utils/validate");
const pagination = require("../utils/pagination");
const redis = require("../config/redis");

/**
 * @route PATCH /api/v1/admins/:admin_id?
 * @desc Update an existing admin’s account information. If no `admin_id` is provided
 *       in the URL, the authenticated admin updates their own profile.
 * @access Private (Admin)
 *
 * @header Authorization - Bearer token of the authenticated admin. Required.
 *
 * @body {string} [name] - New name to assign to the admin.
 * @body {string} [email] - New email. Must be unique and properly formatted.
 * @body {string} [password] - New password. Must meet strong password rules.
 * @body {string} [phone] - New phone number. Must follow a valid phone format.
 *
 * @returns {Object} 200 - Success response with updated admin data
 * @returns {boolean} success - Indicates whether the update was successful
 * @returns {string} message - Status message describing the outcome
 * @returns {Object} data - The updated admin object
 *
 * @throws {403} If the authenticated user does not have admin privileges
 * @throws {404} If the specified admin does not exist
 * @throws {400} If provided fields are invalid, fail validation, or no valid fields were sent
 * @throws {400} If attempting to use an email already taken by another admin
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint updates the information of an existing admin. Only authenticated admins
 * have permission to perform this action. The target admin can be specified via the
 * `admin_id` URL parameter; if omitted, the authenticated admin updates their own account.
 *
 * Validation rules:
 * - Only allowed fields (`name`, `email`, `password`, `phone`) are accepted.
 * - Passwords must meet strong security criteria and will be hashed before storage.
 * - Email must be properly formatted and not already used by another admin.
 * - Phone numbers must follow a valid format.
 *
 * Once the update is successful, any cached admin-related keys in Redis (pattern `admins:*`)
 * are cleared to maintain consistency across cached responses.
 *
 * Steps performed:
 * 1. Verify that the requester is an authorized admin.
 * 2. Determine whether to update the target admin or the authenticated admin.
 * 3. Validate all incoming fields and apply security rules.
 * 4. Hash passwords if included in the update.
 * 5. Ensure updated email does not conflict with another admin’s account.
 * 6. Build a dynamic SQL UPDATE query based on provided fields.
 * 7. Execute the update and return the updated admin record.
 * 8. Clear related Redis cache keys to ensure consistency.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Admin updated successfully",
 *   "data": {
 *     "id": "23",
 *     "name": "Updated Name",
 *     "email": "updated@example.com",
 *     "phone": "+123456789",
 *     "created_at": "2024-01-20T12:00:00Z",
 *     "updated_at": "2024-02-10T14:22:00Z"
 *   }
 * }
 */

const updateAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can update an admin",
      });
    }

    let adminId = req.params.admin_id || req.user.id;

    const existAdmin = await pool.query(
      "SELECT email FROM Admin WHERE id = $1",
      [adminId]
    );

    if (existAdmin.rows.length === 0) {
      return res.status(404).json({ message: "Admin not found." });
    }

    const allowedFields = ["name", "email", "password", "phone"];
    const updates = { ...req.body };

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

    if (updates.email) {
      if (!validateEmail(updates.email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }

      const emailExists = await pool.query(
        "SELECT id FROM Admin WHERE email = $1",
        [updates.email]
      );

      if (emailExists.rows.length > 0 && emailExists.rows[0].id !== adminId) {
        return res.status(400).json({
          success: false,
          message: "Email already used by another admin",
        });
      }
    }

    if (updates.phone && !validatePhone(updates.phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format",
      });
    }

    const keys = Object.keys(updates).filter((key) =>
      allowedFields.includes(key)
    );

    if (keys.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    const setClause = keys
      .map((key, index) => `${key} = $${index + 1}`)
      .join(", ");
    const values = keys.map((key) => updates[key]);
    values.push(adminId);

    const result = await pool.query(
      `UPDATE Admin 
       SET ${setClause} 
       WHERE id = $${values.length} 
       RETURNING id, name, email, phone, created_at, updated_at`,
      values
    );

    const keysRids = await redis.keys("admins:*");
    if (keysRids.length > 0) {
      await redis.del(keysRids);
    }

    return res.status(200).json({
      success: true,
      message: "Admin updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating admin:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route GET /api/v1/admin/:id
 * @desc Fetch detailed information for a specific admin using their unique ID.
 *       Only authenticated admins are permitted to access this endpoint.
 * @access Private (Admin Only)
 *
 * @param {string} req.params.id - The unique identifier of the admin to be retrieved.
 *
 * @header Authorization - A valid Bearer token belonging to an authenticated admin. Required.
 *
 * @returns {Object} 200 - Success response containing admin details
 * @returns {boolean} success - Indicates the operation was successful
 * @returns {string} message - Description of the operation result
 * @returns {Object} data - Admin profile information
 * @returns {string} data.id - Admin ID
 * @returns {string} data.name - Admin full name
 * @returns {string} data.phone - Admin phone number
 * @returns {string} data.email - Admin email address
 * @returns {string} data.created_at - Timestamp of admin creation
 * @returns {string} data.updated_at - Timestamp of last admin update
 *
 * @throws {403} If the authenticated user is not an admin
 * @throws {404} If no admin exists with the specified ID
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint retrieves detailed information for a specific admin.
 * Access to this resource is strictly limited to authenticated users with the `admin` role.
 * The system validates role permissions before querying the database.
 *
 * Steps performed:
 * 1. Verify that the authenticated user has an admin role.
 * 2. Extract the admin ID from the route parameters.
 * 3. Query the database and retrieve admin information.
 * 4. Return the admin data if found; otherwise return a not-found response.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Admin details fetched successfully",
 *   "data": {
 *       "id": "c1b3c8ae-9bc2-4c91-8ef2-9b64c113a9a8",
 *       "name": "John Doe",
 *       "phone": "+201234567890",
 *       "email": "admin@example.com",
 *       "created_at": "2025-01-15T13:45:22.123Z",
 *       "updated_at": "2025-03-01T09:10:05.456Z"
 *   }
 * }
 */

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
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching admin details:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route GET /api/v1/admin
 * @desc Retrieve a paginated list of all registered admins.
 *       Only authenticated admins are allowed to access this endpoint.
 * @access Private (Admin Only)
 *
 * @header Authorization - Bearer token of an authenticated admin. Required.
 *
 * @queryParam {number} page - The current page number for pagination (optional, default from middleware).
 * @queryParam {number} limit - Maximum number of admin records per page (optional, default from middleware).
 *
 * @returns {Object} 200 - Success response containing paginated admin list
 * @returns {boolean} success - Indicates whether the operation succeeded
 * @returns {number} page - Current page number
 * @returns {number} limit - Number of items returned per page
 * @returns {number} total - Total number of admin records
 * @returns {number} totalPages - Total available pages
 * @returns {Array<Object>} data - List of admin records
 * @returns {string} data.id - Admin ID
 * @returns {string} data.name - Admin full name
 * @returns {string} data.phone - Admin phone number
 * @returns {string} data.email - Admin email address
 * @returns {string} data.created_at - Timestamp of creation
 * @returns {string} data.updated_at - Timestamp of last update
 *
 * @throws {403} If the authenticated user does not have an admin role
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint generates a paginated list of all admins stored in the database.
 * It uses Redis caching to significantly speed up subsequent requests for the
 * same page and limit combination. If the data is already available in Redis,
 * it is returned directly without querying the database.
 *
 * Steps performed:
 * 1. Validate the authenticated user's role to ensure they are an admin.
 * 2. Extract pagination parameters (page, limit, skip) from the request.
 * 3. Check Redis for cached results using a key-based caching strategy.
 * 4. If cached data exists, return it immediately.
 * 5. Otherwise:
 *      - Query the database for the total count of admins.
 *      - Fetch paginated admin records.
 *      - Prepare the structured response.
 *      - Store the response in Redis with a 1-hour expiration.
 * 6. Return the final paginated admin list to the client.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "page": 1,
 *   "limit": 10,
 *   "total": 42,
 *   "totalPages": 5,
 *   "data": [
 *     {
 *       "id": "a91038f0-9491-4cb7-a717-7060e7458b2b",
 *       "name": "Mohamed Ali",
 *       "phone": "+201234567890",
 *       "email": "mohamed@example.com",
 *       "created_at": "2025-02-03T10:21:34.000Z",
 *       "updated_at": "2025-03-01T14:12:00.000Z"
 *     }
 *   ]
 * }
 */

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
    const cachedData = await redis.get(cacheKey);
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
    await redis.setEx(cacheKey, 3600, JSON.stringify(responseData));
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

/**
 * @route DELETE /api/v1/admin/:id
 * @desc Delete a specific admin by ID. Only admins with proper authorization can perform this action.
 *       An admin cannot delete themselves.
 * @access Private (Admin)
 *
 * @param {string} id - Admin ID to be deleted (from URL params)
 *
 * @returns {Object} 200 - Success response confirming deletion
 * @returns {boolean} success - Indicates whether the deletion was processed
 * @returns {string} message - Description of the deletion result
 *
 * @throws {400} If the admin attempts to delete themselves
 * @throws {403} If the requesting user is not an admin
 * @throws {404} If the admin with the provided ID is not found
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint allows an authorized admin to delete another admin from the database.
 * It performs the following steps:
 * 1. Check if the requester has the "admin" role.
 * 2. Verify that the admin is not attempting to delete themselves.
 * 3. Delete the admin from the database.
 * 4. Invalidate related Redis cache entries (`admins:*`) to ensure fresh data on future requests.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Admin deleted successfully"
 * }
 *
 * Example error response (attempting self-deletion):
 * {
 *   "success": false,
 *   "message": "Admin cannot delete themselves"
 * }
 */

const deleteAdminById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can delete an admin",
      });
    }

    const adminId = req.params.id;

    if (req.user.id === adminId) {
      return res.status(400).json({
        success: false,
        message: "Admin cannot delete themselves",
      });
    }

    const result = await pool.query("DELETE FROM Admin WHERE id = $1", [
      adminId,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    const keysRids = await redis.keys("admins:*");
    if (keysRids.length > 0) {
      await redis.del(keysRids);
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

/**
 * @route DELETE /api/v1/admin
 * @desc Delete all admins from the database. Only authorized admins can perform this action.
 * @access Private (Admin)
 *
 * @returns {Object} 200 - Success response confirming deletion
 * @returns {boolean} success - Indicates whether the deletion was processed
 * @returns {string} message - Description of the deletion result
 * @returns {number} count - The number of admins deleted
 *
 * @throws {403} If the requesting user is not an admin
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint allows an authorized admin to delete all admin records from the database.
 * It performs the following steps:
 * 1. Verify that the requester has the "admin" role.
 * 2. Delete all records from the `Admin` table.
 * 3. Remove any cached admin data from Redis (`admins:*`) to ensure future requests fetch fresh data.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "All admins deleted successfully",
 *   "count": 5
 * }
 */

const deleteAllAdmins = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can delete all admins",
      });
    }

    const result = await pool.query("DELETE FROM Admin");

    const keysRids = await redis.keys("admins:*");
    if (keysRids.length > 0) {
      await redis.del(keysRids);
    }

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
  updateAdmin,
  getAdminById,
  getAllAdmins,
  deleteAdminById,
  deleteAllAdmins,
};
