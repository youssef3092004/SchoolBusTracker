const pool = require("../config/db");
const redis = require("../config/redis");
const pagination = require("../utils/pagination");

const createPermission = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can create permissions",
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

    const existingPermission = await pool.query(
      "SELECT * FROM Permission WHERE name = $1",
      [name]
    );
    if (existingPermission.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Permission with this name already exists",
      });
    }

    const newPermission = await pool.query(
      "INSERT INTO Permission (name, description) VALUES ($1, $2) RETURNING *",
      [name, description]
    );

    return res.status(201).json({
      success: true,
      data: newPermission.rows[0],
    });
  } catch (error) {
    console.error("Error creating permission:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getPermissionById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can view permissions",
      });
    }

    const id = req.params.id;
    const permission = await pool.query(
      "SELECT * FROM Permission WHERE id = $1",
      [id]
    );

    if (permission.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Permission not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: permission.rows[0],
    });
  } catch (error) {
    console.error("Error fetching permission:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAllPermissions = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can view permissions",
      });
    }

    const { page, limit, skip } = pagination(req);

    const cacheKey = `permissions:${page}:${limit}`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log("Returning data from Redis cache");
      return res.status(200).json(JSON.parse(cachedData));
    }

    const countResult = await pool.query(
      "SELECT COUNT(*) AS total FROM Permission"
    );
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    const permissions = await pool.query(
      "SELECT * FROM Permission ORDER BY CREATED_AT DESC LIMIT $1 OFFSET $2",
      [limit, skip]
    );

    if (permissions.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No permissions found",
      });
    }

    const responseData = {
      success: true,
      page: page,
      limit: limit,
      totalPages: totalPages,
      data: permissions.rows,
    };

    console.log("Storing data in Redis cache");
    await redis.set(cacheKey, JSON.stringify(responseData));

    return res.status(200).json({ responseData });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updatePermissionById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can update permissions",
      });
    }

    const permissionId = req.params.id;
    const allowedFields = ["name", "description"];
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
    values.push(permissionId);

    const query = `
      UPDATE Permission
      SET ${setClause}
      WHERE id = $${values.length}
      RETURNING id, name, description, updated_at;
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Permission not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Permission updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating permission:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deletePermissionById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can delete permissions",
      });
    }

    const id = req.params.id;

    const result = await pool.query(
      "DELETE FROM Permission WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Permission not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Permission deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting permission:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteAllPermissions = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can delete all permissions",
      });
    }

    const result = await pool.query("DELETE FROM Permission RETURNING *");

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No permissions found to delete.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "All permissions deleted successfully.",
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Error deleting all permissions:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createPermission,
  getPermissionById,
  getAllPermissions,
  updatePermissionById,
  deletePermissionById,
  deleteAllPermissions,
};
