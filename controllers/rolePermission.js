const pool = require("../config/db");
const redis = require("../config/redis");
const pagination = require("../utils/pagination");

/**
 * @route POST /api/v1/role-permissions
 * @desc Assign one or more permissions to a specific role. Only users with the "admin" role can perform this action.
 * @access Private (Admin)
 *
 * @param {string} role - The name of the role to assign permissions to (from request body)
 * @param {Array<string>} permissionId_list - Array of permission IDs (UUIDs) to assign to the role
 * @param {boolean} [is_allowed=false] - Optional flag indicating whether the permission is allowed
 *
 * @returns {Object} 201 - Success response containing the newly created role-permission records
 * @returns {boolean} success - Indicates whether the operation was successful
 * @returns {string} message - Description of the operation result
 * @returns {Array<Object>} data - Array of newly created role-permission records
 *
 * @throws {400} If the role is missing in the request body
 * @throws {400} If permissionId_list is missing or empty
 * @throws {400} If any of the permission IDs already exist for the role
 * @throws {403} If the requesting user does not have the "admin" role
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint allows an authorized admin to assign multiple permissions to a role. It performs the following steps:
 * 1. Verify the requester has the "admin" role.
 * 2. Validate the request body to ensure `role` and `permissionId_list` are provided and valid.
 * 3. Check if any of the permission IDs already exist for the role in the database.
 * 4. Insert new role-permission mappings into the `RolePermission` table.
 * 5. Clear related Redis cache entries (`rolePermissionsGrouped:*`) to ensure fresh data on future requests.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Permissions assigned to role successfully",
 *   "data": [
 *     {
 *       "role": "manager",
 *       "permission_id": "uuid1",
 *       "is_allowed": true
 *     },
 *     {
 *       "role": "manager",
 *       "permission_id": "uuid2",
 *       "is_allowed": true
 *     }
 *   ]
 * }
 *
 * Example error response (permission already exists):
 * {
 *   "success": false,
 *   "message": "The following permission IDs already exist for this role: uuid1, uuid2"
 * }
 */

const createPermissionRole = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can assign permissions",
      });
    }

    const { role, permissionId_list, is_allowed = false } = req.body;

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Role is required",
      });
    }

    if (!Array.isArray(permissionId_list) || permissionId_list.length === 0) {
      return res.status(400).json({
        success: false,
        message: "permissionId_list must be a non-empty array",
      });
    }

    const isExisting = await pool.query(
      "SELECT permission_id FROM rolePermission WHERE role = $1 AND permission_id = ANY($2::uuid[])",
      [role, permissionId_list]
    );

    if (isExisting.rows.length > 0) {
      const existingIds = isExisting.rows.map((row) => row.permission_id);
      return res.status(400).json({
        success: false,
        message: `The following permission IDs already exist for this role: ${existingIds.join(
          ", "
        )}`,
      });
    }

    const values = permissionId_list
      .map((pid) => `('${role}', '${pid}', ${is_allowed})`)
      .join(", ");

    const result = await pool.query(
      `INSERT INTO RolePermission (role, permission_id, is_allowed)
       VALUES ${values}
       RETURNING *;`
    );

    const keys = await redis.keys("rolePermissionsGrouped:*");
    for (const key of keys) {
      await redis.del(key);
    }

    return res.status(201).json({
      success: true,
      message: "Permissions assigned to role successfully",
      data: result.rows,
    });
  } catch (error) {
    console.error("Error assigning permission:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route GET /api/v1/role-permissions/:role/:id
 * @desc Retrieve a specific permission assigned to a role by its ID. Only authorized users should access this endpoint.
 * @access Private
 *
 * @param {string} role - The role name (from URL params)
 * @param {string} id - The permission ID (UUID) to retrieve (from URL params)
 *
 * @returns {Object} 200 - Success response containing the permission data
 * @returns {boolean} success - Indicates whether the operation was successful
 * @returns {string} message - Description of the operation result
 * @returns {Object} data - The role-permission record retrieved from the database
 *
 * @throws {400} If the `role` parameter is missing
 * @throws {400} If the `id` parameter is missing
 * @throws {404} If no permission is found for the given role and ID
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint allows retrieval of a specific permission assigned to a role. It performs the following steps:
 * 1. Validates that both `role` and `id` parameters are provided.
 * 2. Queries the `RolePermission` table for a record matching the provided role and ID.
 * 3. Returns the permission if found, or an error if not.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Permission retrieved successfully",
 *   "data": {
 *     "id": "uuid1",
 *     "role": "manager",
 *     "permission_id": "uuid-permission-123",
 *     "is_allowed": true
 *   }
 * }
 *
 * Example error response (permission not found):
 * {
 *   "success": false,
 *   "message": "No permission found for this role and id"
 * }
 */

const getPermissionsByRoleId = async (req, res) => {
  try {
    const { role, id } = req.params;

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Role is required",
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Permission ID is required",
      });
    }

    const result = await pool.query(
      `
      SELECT * FROM RolePermission
      WHERE id = $1 AND role = $2
      `,
      [id, role]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No permission found for this role and id",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Permission retrieved successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching role permission by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route GET /api/v1/role-permissions
 * @desc Retrieve all role-permission mappings, grouped by role. Only users with the "admin" role can access this endpoint.
 * @access Private (Admin)
 *
 * @query {number} page - Page number for pagination (optional, default handled by pagination function)
 * @query {number} limit - Number of items per page for pagination (optional, default handled by pagination function)
 *
 * @returns {Object} 200 - Success response containing grouped role-permission data
 * @returns {boolean} success - Indicates whether the operation was successful
 * @returns {string} message - Description of the operation result
 * @returns {number} totalRoles - Total number of roles retrieved in this page
 * @returns {number} page - Current page number
 * @returns {number} limit - Limit of items per page
 * @returns {Array<Object>} data - Array of role objects with their permissions
 * @returns {string} data[].role - Role name
 * @returns {Array<Object>} data[].permissions - Array of permissions for the role
 * @returns {string} data[].permissions[].permission_id - ID of the permission
 * @returns {boolean} data[].permissions[].is_allowed - Permission allowed flag
 * @returns {string} data[].permissions[].created_at - Creation timestamp
 * @returns {string} data[].permissions[].updated_at - Update timestamp
 *
 * @throws {403} If the requesting user does not have the "admin" role
 * @throws {404} If no role permissions are found
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint allows an admin to fetch all role-permission mappings with pagination and caching. It performs the following steps:
 * 1. Verify the requester has the "admin" role.
 * 2. Apply pagination using the `pagination` helper function.
 * 3. Check Redis cache for previously stored grouped role-permission data.
 * 4. If not cached, query the database for role-permission records.
 * 5. Group permissions by role.
 * 6. Save the grouped result in Redis cache for future requests.
 * 7. Return grouped data in the response.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Role permissions fetched successfully",
 *   "totalRoles": 2,
 *   "page": 1,
 *   "limit": 10,
 *   "data": [
 *     {
 *       "role": "admin",
 *       "permissions": [
 *         {
 *           "permission_id": "uuid1",
 *           "is_allowed": true,
 *           "created_at": "2025-12-12T10:00:00Z",
 *           "updated_at": "2025-12-12T10:00:00Z"
 *         }
 *       ]
 *     },
 *     {
 *       "role": "manager",
 *       "permissions": [
 *         {
 *           "permission_id": "uuid2",
 *           "is_allowed": false,
 *           "created_at": "2025-12-12T09:00:00Z",
 *           "updated_at": "2025-12-12T09:00:00Z"
 *         }
 *       ]
 *     }
 *   ]
 * }
 *
 * Example error response (unauthorized):
 * {
 *   "success": false,
 *   "message": "Access denied: only admin can view all role permissions"
 * }
 */

const getAllRolePermissions = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can view all role permissions",
      });
    }

    const { page, limit, skip } = pagination(req);
    const cacheKey = `rolePermissionsGrouped:${page}:${limit}`;

    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log("Returning grouped data from Redis cache");
      return res.status(200).json(JSON.parse(cachedData));
    }

    const result = await pool.query(
      `
      SELECT role, permission_id, is_allowed, created_at, updated_at
      FROM RolePermission
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, skip]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No role permissions found",
      });
    }

    const grouped = {};
    result.rows.forEach((row) => {
      if (!grouped[row.role]) grouped[row.role] = [];
      grouped[row.role].push({
        permission_id: row.permission_id,
        is_allowed: row.is_allowed,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    });

    const roles = Object.keys(grouped).map((role) => ({
      role,
      permissions: grouped[role],
    }));

    const responseData = {
      success: true,
      message: "Role permissions fetched successfully",
      totalRoles: roles.length,
      page,
      limit,
      data: roles,
    };

    console.log("Saving grouped data to Redis cache");
    await redis.set(cacheKey, JSON.stringify(responseData));

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching grouped role permissions:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route PATCH /api/v1/role-permissions/:id
 * @desc Update specific fields of a role-permission mapping by ID. Only users with the "admin" role can perform this action.
 * @access Private (Admin)
 *
 * @param {string} id - The ID of the role-permission record to update (from URL params)
 * @param {Object} req.body - Fields to update
 * @param {string} [req.body.role] - Optional new role name
 * @param {string} [req.body.permission_id] - Optional new permission ID
 * @param {boolean} [req.body.is_allowed] - Optional flag indicating whether the permission is allowed
 *
 * @returns {Object} 200 - Success response containing the updated role-permission record
 * @returns {boolean} success - Indicates whether the operation was successful
 * @returns {string} message - Description of the operation result
 * @returns {Object} data - The updated role-permission record
 *
 * @throws {403} If the requesting user does not have the "admin" role
 * @throws {400} If no valid fields are provided in the request body
 * @throws {404} If no role-permission record is found for the given ID
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint allows an admin to update specific fields of a role-permission mapping. It performs the following steps:
 * 1. Verify the requester has the "admin" role.
 * 2. Filter the request body to include only allowed fields (`role`, `permission_id`, `is_allowed`).
 * 3. Return an error if no valid fields are provided.
 * 4. Construct the SQL UPDATE query dynamically based on provided fields.
 * 5. Execute the query and return the updated record.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Role permission updated successfully",
 *   "data": {
 *     "id": "uuid1",
 *     "role": "manager",
 *     "permission_id": "uuid-permission-123",
 *     "is_allowed": true,
 *     "created_at": "2025-12-12T10:00:00Z",
 *     "updated_at": "2025-12-12T11:00:00Z"
 *   }
 * }
 *
 * Example error response (no valid fields):
 * {
 *   "success": false,
 *   "message": "No valid fields provided for update"
 * }
 */

const updatePermissionsByRole = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can update role permissions",
      });
    }

    const id = req.params.id;
    const allowedFields = ["role", "permission_id", "is_allowed"];
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
    values.push(id);

    const query = `
      UPDATE RolePermission
      SET ${setClause}
      WHERE id = $${values.length}
      RETURNING *;
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Role permission not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Role permission updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating role permission:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route DELETE /api/v1/role-permissions/:roleId/:permissionId
 * @desc Delete a specific permission from a role. Only users with the "admin" role can perform this action.
 * @access Private (Admin)
 *
 * @param {string} roleId - The role name or ID from which the permission will be removed (from URL params)
 * @param {string} permissionId - The ID of the permission to remove from the role (from URL params)
 *
 * @returns {Object} 200 - Success response confirming deletion
 * @returns {boolean} success - Indicates whether the deletion was processed successfully
 * @returns {string} message - Description of the deletion result
 *
 * @throws {400} If the `roleId` parameter is missing
 * @throws {400} If the `permissionId` parameter is missing
 * @throws {403} If the requesting user does not have the "admin" role
 * @throws {404} If the role-permission pair is not found
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint allows an admin to remove a specific permission from a role. It performs the following steps:
 * 1. Verify the requester has the "admin" role.
 * 2. Validate that both `roleId` and `permissionId` parameters are provided.
 * 3. Execute a DELETE query on the `RolePermission` table for the specified role and permission.
 * 4. Return a success message if the deletion is successful, or an error if no record is found.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Permission removed from role successfully"
 * }
 *
 * Example error response (role-permission not found):
 * {
 *   "success": false,
 *   "message": "Role-permission pair not found"
 * }
 */

const deletePermissionRole = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can delete permissions",
      });
    }

    const { roleId, permissionId } = req.params;

    if (!roleId) {
      return res.status(400).json({
        success: false,
        message: "Role ID is required",
      });
    }

    if (!permissionId) {
      return res.status(400).json({
        success: false,
        message: "Permission ID is required",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM RolePermission
      WHERE role = $1 AND permission_id = $2
      RETURNING *;
      `,
      [roleId, permissionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Role-permission pair not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Permission removed from role successfully",
    });
  } catch (error) {
    console.error("Error deleting role permission:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route DELETE /api/v1/role-permissions/:role
 * @desc Delete all permissions assigned to a specific role. Only users with the "admin" role can perform this action.
 * @access Private (Admin)
 *
 * @param {string} role - The role name for which all permissions will be deleted (from URL params)
 *
 * @returns {Object} 200 - Success response confirming deletion
 * @returns {boolean} success - Indicates whether the deletion was processed successfully
 * @returns {string} message - Description of the deletion result
 * @returns {number} count - Number of permissions deleted
 * @returns {Array<Object>} deleted - Array of deleted role-permission records
 *
 * @throws {400} If the `role` parameter is missing
 * @throws {403} If the requesting user does not have the "admin" role
 * @throws {404} If no permissions are found for the given role
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint allows an admin to delete all permissions associated with a specific role. It performs the following steps:
 * 1. Validate that the `role` parameter is provided.
 * 2. Verify that the requester has the "admin" role.
 * 3. Execute a DELETE query on the `RolePermission` table for the specified role.
 * 4. Return the number of deleted permissions and the deleted records.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "All permissions deleted for role: manager",
 *   "count": 3,
 *   "deleted": [
 *     { "id": "uuid1", "role": "manager", "permission_id": "perm1", "is_allowed": true },
 *     { "id": "uuid2", "role": "manager", "permission_id": "perm2", "is_allowed": false },
 *     { "id": "uuid3", "role": "manager", "permission_id": "perm3", "is_allowed": true }
 *   ]
 * }
 *
 * Example error response (role not found):
 * {
 *   "success": false,
 *   "message": "No permissions found for this role"
 * }
 */

const deleteAllPermissionsByRole = async (req, res) => {
  try {
    const { role } = req.params;

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Role is required",
      });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin can delete all permissions for a role",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM RolePermission
      WHERE role = $1
      RETURNING *;
      `,
      [role]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No permissions found for this role",
      });
    }

    return res.status(200).json({
      success: true,
      message: `All permissions deleted for role: ${role}`,
      count: result.rows.length,
      deleted: result.rows,
    });
  } catch (error) {
    console.error("Error deleting all role permissions:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route DELETE /api/v1/role-permissions
 * @desc Delete all role-permission records from the database. Only users with the "admin" role can perform this action.
 * @access Private (Admin)
 *
 * @returns {Object} 200 - Success response confirming deletion
 * @returns {boolean} success - Indicates whether the deletion was processed successfully
 * @returns {string} message - Description of the deletion result, including total deleted records
 *
 * @throws {403} If the requesting user does not have the "admin" role
 * @throws {404} If there are no role-permission records to delete
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint allows an admin to delete all role-permission mappings in the system. It performs the following steps:
 * 1. Verify the requester has the "admin" role.
 * 2. Count the total number of role-permission records.
 * 3. Return a 404 error if no records exist.
 * 4. Delete all records from the `RolePermission` table.
 * 5. Return a success message indicating how many records were deleted.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "All role permissions (15) deleted successfully"
 * }
 *
 * Example error response (no records found):
 * {
 *   "success": false,
 *   "message": "No role permissions found to delete"
 * }
 */

const deleteAllRolePermissions = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can delete all role permissions",
      });
    }

    const countResult = await pool.query("SELECT COUNT(*) FROM RolePermission");
    const total = parseInt(countResult.rows[0].count);

    if (total === 0) {
      return res.status(404).json({
        success: false,
        message: "No role permissions found to delete",
      });
    }

    await pool.query("DELETE FROM RolePermission");

    return res.status(200).json({
      success: true,
      message: `All role permissions (${total}) deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting all role permissions:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createPermissionRole,
  getPermissionsByRoleId,
  getAllRolePermissions,
  updatePermissionsByRole,
  deletePermissionRole,
  deleteAllPermissionsByRole,
  deleteAllRolePermissions,
};
