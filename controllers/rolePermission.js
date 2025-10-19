const pool = require("../config/db");
const redis = require("../config/redis");
const pagination = require("../utils/pagination");

const createPermissionRole = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can assign permissions",
      });
    }

    const { role, permission_id, is_allowed = false } = req.body;

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Role are required",
      });
    }

    if (!permission_id) {
      return res.status(400).json({
        success: false,
        message: "permission_id are required",
      });
    }

    const exists = await pool.query(
      "SELECT * FROM RolePermission WHERE permission_id = $1",
      [permission_id]
    );
    
    const result = await pool.query(
      `INSERT INTO RolePermission (role, permission_id, is_allowed)
       VALUES ($1, $2, $3) RETURNING *`,
      [role, permission_id, is_allowed]
    );

    return res.status(201).json({
      success: true,
      message: "Permission assigned to role successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error assigning permission:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getPermissionsByRoleId = async (req, res) => {
  try {
    const { role, id } = req.params;

    if (!role || !id) {
      return res.status(400).json({
        success: false,
        message: "Both role and permission ID are required",
      });
    }

    const result = await pool.query(
      `
      SELECT * FROM RolePermission
      WHERE role = $1 AND id = $2
      `,
      [role, id]
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

const deletePermissionRole = async (req, res) => {
  try {
    const { role, id } = req.params;

    if (!role || !id) {
      return res.status(400).json({
        success: false,
        message: "Both role and permission ID are required",
      });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can delete permissions",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM RolePermission
      WHERE role = $1 AND id = $2
      RETURNING *;
      `,
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Role-permission pair not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Permission deleted for role successfully",
    });
  } catch (error) {
    console.error("Error deleting role permission:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

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
