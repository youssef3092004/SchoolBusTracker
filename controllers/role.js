const pool = require("../config/db");
const redis = require("../config/redis");
const pagination = require("../utils/pagination");

/**
 * @route POST /api/v1/roles/create
 * @desc Create a new role in the system. Only administrators with proper authorization
 *       can perform this action. Roles are used to manage RBAC permissions across the platform.
 * @access Private (Admin)
 *
 * @body {string} name - Unique name of the role to be created
 * @body {string} description - Description explaining the purpose of the role
 *
 * @returns {Object} 201 - Success response including the created role data
 * @returns {boolean} success - Indicates if the role creation was successful
 * @returns {string} message - Description of the result
 * @returns {Object} data - The newly created role object
 *
 * @throws {400} If the name or description is missing
 * @throws {400} If a role with the same name already exists
 * @throws {403} If the requesting user does not have admin privileges
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint allows an administrator to create a new role in the database.
 * It follows these steps:
 *
 * 1. Validate that the requester is an admin.
 * 2. Validate that both `name` and `description` are provided in the request body.
 * 3. Check whether a role with the same name already exists.
 * 4. Insert the new role into the database and return the created record.
 * 5. Clear cached role lists (`roles:*`) from Redis to ensure future requests return updated data.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Role created successfully",
 *   "data": {
 *     "id": "uuid",
 *     "name": "teacher_assistant",
 *     "description": "Can assist teachers and view related information"
 *   }
 * }
 *
 * Example error response (duplicate role):
 * {
 *   "success": false,
 *   "message": "Role already exists"
 * }
 */

const createRole = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can create a role",
      });
    }

    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }
    if (!description) {
      return res.status(400).json({
        success: false,
        message: "Description is required",
      });
    }

    const existingRole = await pool.query(
      "SELECT * FROM Role WHERE name = $1",
      [name]
    );

    if (existingRole.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Role already exists",
      });
    }

    const newRole = await pool.query(
      "INSERT INTO Role (name, description) VALUES ($1, $2) RETURNING *",
      [name, description]
    );

    const keys = await redis.keys("roles:*");
    if (keys.length > 0) {
      await redis.del(keys);
    }

    return res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: newRole.rows[0],
    });
  } catch (error) {
    console.error("Error creating role:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route GET /api/v1/roles/getall
 * @desc Retrieve a paginated list of all roles in the system.
 *       Only administrators are authorized to access this endpoint.
 * @access Private (Admin)
 *
 * @query {number} page - Page number for pagination (default depends on pagination utility)
 * @query {number} limit - Number of items per page (default depends on pagination utility)
 *
 * @returns {Object} 200 - Successful response containing a paginated list of roles
 * @returns {boolean} success - Indicates whether the request was successful
 * @returns {number} page - Current page number
 * @returns {number} limit - Number of items per page
 * @returns {number} total - Total number of roles in the system
 * @returns {number} totalPages - Number of available pages
 * @returns {Array<Object>} data - Array of role objects
 *
 * @throws {403} If the user does not have admin privileges
 * @throws {404} If no roles exist in the database
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint retrieves all roles stored in the database using pagination.
 * It includes the following workflow:
 *
 * 1. Validate that the requester is an admin.
 * 2. Extract pagination values (`page`, `limit`, `skip`) using the pagination utility.
 * 3. Check if the requested page exists in Redis cache (`roles:page=X:limit=Y`).
 *    - If found, return the cached response instantly for optimized performance.
 * 4. Query the database for the requested page of roles, ordered by `created_at` descending.
 * 5. If no roles are found, return a `404` response.
 * 6. Calculate total roles and total number of pages.
 * 7. Construct a standardized response object containing:
 *    - Pagination metadata
 *    - Data array of roles
 * 8. Store the response in Redis with a 1-hour expiration (3600 seconds).
 * 9. Return the final response to the client.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "page": 1,
 *   "limit": 10,
 *   "total": 32,
 *   "totalPages": 4,
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "name": "supervisor",
 *       "description": "Responsible for managing buses"
 *     }
 *   ]
 * }
 *
 * Example error response (no roles found):
 * {
 *   "success": false,
 *   "message": "No roles found"
 * }
 */

const getAllRoles = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can update a role",
      });
    }
    const { page, limit, skip } = pagination(req);

    const cacheKey = `roles:page=${page}:limit=${limit}`;
    const cachedRoles = await redis.get(cacheKey);
    if (cachedRoles) {
      console.log("Returning data from Redis cache");
      return res.status(200).json(JSON.parse(cachedRoles));
    }
    const rolesResult = await pool.query(
      "SELECT * FROM Role ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, skip]
    );
    if (rolesResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No roles found",
      });
    }
    const totalRolesResult = await pool.query("SELECT COUNT(*) FROM Role");
    const totalRoles = parseInt(totalRolesResult.rows[0].count);
    const totalPages = Math.ceil(totalRoles / limit);

    const response = {
      success: true,
      success: true,
      page,
      limit,
      total: totalRoles,
      totalPages,
      data: rolesResult.rows,
    };

    await redis.setEx(cacheKey, 3600, JSON.stringify(response));
    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching roles:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route GET /api/v1/roles/:id
 * @desc Fetch a specific role by its unique ID. Only administrators are allowed to access this data.
 * @access Private (Admin)
 *
 * @param {string} id - Role ID to retrieve (from URL params)
 *
 * @returns {Object} 200 - Success response with role details
 * @returns {boolean} success - Indicates whether the operation was successful
 * @returns {string} message - Description of the operation result
 * @returns {Object} data - The full role record returned from the database
 *
 * @throws {400} If the role ID is missing in the request parameters
 * @throws {403} If the requesting user does not have admin privileges
 * @throws {404} If no role with the provided ID exists
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint allows an admin to retrieve detailed information about a specific role.
 * The process includes the following steps:
 *
 * 1. Verify that the requester has the **admin** role.
 * 2. Ensure an ID was provided in the request parameters.
 * 3. Query the database for a role with the provided ID.
 *    - If no matching record is found, respond with a `404 Not Found` error.
 * 4. Return the role details in a structured JSON response.
 *
 * No Redis caching is used here because this endpoint returns a single role,
 * and data is expected to be retrieved in real-time to avoid outdated information.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Role fetched successfully",
 *   "data": {
 *     "id": "12345",
 *     "name": "supervisor_manager",
 *     "description": "Manages all supervisors",
 *     "created_at": "2025-10-18T10:42:00.123Z"
 *   }
 * }
 *
 * Example error response (role not found):
 * {
 *   "success": false,
 *   "message": "Role not found"
 * }
 */

const getRoleById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can update a role",
      });
    }
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Role ID is required",
      });
    }

    const roleResult = await pool.query("SELECT * FROM Role WHERE id = $1", [
      id,
    ]);
    if (roleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Role fetched successfully",
      data: roleResult.rows[0],
    });
  } catch (error) {
    console.error("Error fetching role by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route DELETE /api/v1/roles/delete/:id
 * @desc Delete a specific role by its unique ID. Only administrators are allowed to perform this action.
 * @access Private (Admin)
 *
 * @param {string} id - The Role ID to delete (from URL params)
 *
 * @returns {Object} 200 - Successful response confirming deletion
 * @returns {boolean} success - Indicates the deletion was processed
 * @returns {string} message - Description of the deletion result
 *
 * @throws {400} If the role ID is missing in the request parameters
 * @throws {403} If the requesting user does not have admin privileges
 * @throws {404} If the role with the given ID does not exist
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint allows an authorized administrator to delete an existing role from the system.
 * The logic proceeds as follows:
 *
 * 1. Verify that the requester has the `admin` role.
 * 2. Ensure the required `id` parameter is provided in the request.
 * 3. Check if the role exists in the database.
 *    - If not found, return a `404` error.
 * 4. Delete the role from the database.
 * 5. Invalidate cached role data by removing all Redis keys matching `roles:*`
 *    to prevent outdated results in future role list requests.
 * 6. Return a success message confirming the deletion.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Role deleted successfully"
 * }
 *
 * Example error response (role not found):
 * {
 *   "success": false,
 *   "message": "Role not found"
 * }
 */

const deleteById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can delete a role",
      });
    }
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Role ID is required",
      });
    }
    const roleResult = await pool.query("SELECT * FROM Role WHERE id = $1", [
      id,
    ]);
    if (roleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }
    await pool.query("DELETE FROM Role WHERE id = $1", [id]);

    const keys = await redis.keys("roles:*");
    if (keys.length > 0) {
      await redis.del(keys);
    }

    return res.status(200).json({
      success: true,
      message: "Role deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting role by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route DELETE /api/v1/roles/deleteAll
 * @desc Delete all roles from the system. This action wipes the entire Role table,
 *       and should only be performed by high-privilege administrators.
 * @access Private (Admin)
 *
 * @returns {Object} 200 - Success response confirming the mass deletion
 * @returns {boolean} success - Indicates whether the operation completed successfully
 * @returns {string} message - Description of the deletion result
 * @returns {number} count - Number of deleted role entries
 *
 * @throws {403} If the requesting user does not have admin privileges
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint removes **every record** from the `Role` table. It is considered a
 * high-risk operation because deleting all roles may temporarily break the permission
 * system until new roles are recreated.
 *
 * Operational steps:
 *
 * 1. Confirm that the authenticated user is an **admin**.
 * 2. Execute a full `DELETE` query on the `Role` table.
 * 3. Clear all Redis cache entries related to roles (`roles:*`) to ensure
 *    that future fetch requests do not return stale cached data.
 * 4. Return the number of deleted roles for transparency.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "All roles deleted successfully",
 *   "count": 7
 * }
 *
 * Example error response (non-admin request):
 * {
 *   "success": false,
 *   "message": "Access denied: only admin can delete all roles"
 * }
 */

const deleteAll = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can delete all roles",
      });
    }

    const result = await pool.query("DELETE FROM Role");

    const keys = await redis.keys("roles:*");
    if (keys.length > 0) {
      await redis.del(keys);
    }

    return res.status(200).json({
      success: true,
      message: "All roles deleted successfully",
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Error deleting all roles:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createRole,
  getAllRoles,
  getRoleById,
  deleteById,
  deleteAll,
};
