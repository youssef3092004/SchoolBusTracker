const pool = require("../config/db");
const pagination = require("../utils/pagination");
const redis = require("../config/redis");

const createBus = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school, and school staff can create buses",
      });
    }

    const {
      school_id,
      driver_id,
      supervisor_id,
      capacity,
      route_name,
      status,
    } = req.body;

    const requiredFields = {
      school_id,
      driver_id,
      supervisor_id,
      capacity,
      route_name,
    };
    for (let i in requiredFields) {
      if (!requiredFields[i]) {
        return res.status(400).json({
          success: false,
          message: `${i.charAt(0).toUpperCase() + i.slice(1)} is required`,
        });
      }
    }

    const existingSchool = await pool.query(
      "SELECT * FROM School WHERE id = $1",
      [school_id]
    );

    if (existingSchool.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "School not found",
      });
    }
    const existingDriver = await pool.query(
      "SELECT * FROM Driver WHERE id = $1",
      [driver_id]
    );

    if (existingDriver.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    const newBus = await pool.query(
      `INSERT INTO Bus (school_id, driver_id, supervisor_id, capacity, route_name, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        school_id,
        driver_id,
        supervisor_id,
        capacity,
        route_name,
        status || "active",
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Bus created successfully",
      bus: newBus.rows[0],
    });
  } catch (error) {
    console.error("Error creating bus:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getBusById = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school, and school staff can create buses",
      });
    }
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM Bus WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Bus not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching bus:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAllBuses = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school, and school staff can create buses",
      });
    }

    const { page, limit, skip } = pagination(req);

    const cacheKey = `buses:${page}:${limit}`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log("Serving buses from Redis cache");
      return res.status(200).json(JSON.parse(cachedData));
    }

    const countResult = await pool.query("SELECT COUNT(*) AS total FROM Bus");
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    const result = await pool.query(
      "SELECT * FROM Bus ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, skip]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No buses found",
      });
    }

    const responseData = {
      success: true,
      page,
      limit,
      totalPages,
      total,
      data: result.rows,
    };

    await redis.set(cacheKey, JSON.stringify(responseData), { EX: 3600 });

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching buses:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updateBusById = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school, and school staff can create buses",
      });
    }

    const { id } = req.params;
    const allowedFields = [
      "school_id",
      "driver_id",
      "supervisor_id",
      "capacity",
      "status",
      "route_name",
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
    values.push(id);

    const query = `
      UPDATE Bus
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING *;
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Bus not found",
      });
    }

    await redis.delPattern("buses:*");

    return res.status(200).json({
      success: true,
      message: "Bus updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating bus:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteBusById = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school, and school staff can create buses",
      });
    }

    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM Bus WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Bus not found",
      });
    }

    await redis.delPattern("buses:*");

    return res.status(200).json({
      success: true,
      message: "Bus deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting bus:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteAllBuses = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school, and school staff can create buses",
      });
    }

    const result = await pool.query("DELETE FROM Bus RETURNING *");

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No buses found to delete",
      });
    }

    await redis.delPattern("buses:*");

    return res.status(200).json({
      success: true,
      message: "All buses deleted successfully",
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Error deleting all buses:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getBusesBySchool = async (req, res) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin or school staff can view this data",
      });
    }

    const { school_id } = req.params;
    const { page, limit, skip } = pagination(req);

    const cacheKey = `buses:school:${school_id}:page:${page}:limit:${limit}`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log("Serving from Redis cache");
      return res.status(200).json(JSON.parse(cachedData));
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM Bus WHERE school_id = $1`,
      [school_id]
    );
    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    const result = await pool.query(
      `SELECT * FROM Bus WHERE school_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [school_id, limit, skip]
    );

    const responseData = {
      success: true,
      total,
      page,
      limit,
      totalPages,
      data: result.rows,
    };

    await redis.setEx(cacheKey, 3600, JSON.stringify(responseData));
    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching buses by school:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getBusesBySupervisor = async (req, res) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff" &&
      req.user.role !== "supervisor"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, supervisor, or school staff can view this data",
      });
    }

    const { supervisor_id } = req.params;
    const { page, limit, skip } = pagination(req);

    const cacheKey = `buses:supervisor:${supervisor_id}:page:${page}:limit:${limit}`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log("Serving from Redis cache");
      return res.status(200).json(JSON.parse(cachedData));
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM Bus WHERE supervisor_id = $1`,
      [supervisor_id]
    );
    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    const result = await pool.query(
      `SELECT * FROM Bus WHERE supervisor_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [supervisor_id, limit, skip]
    );

    const responseData = {
      success: true,
      total,
      page,
      limit,
      totalPages,
      data: result.rows,
    };

    await redis.setEx(cacheKey, 3600, JSON.stringify(responseData));
    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching buses by supervisor:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createBus,
  getBusById,
  getAllBuses,
  updateBusById,
  deleteBusById,
  deleteAllBuses,
  getBusesBySchool,
  getBusesBySupervisor,
};
