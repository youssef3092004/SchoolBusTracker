const pool = require("../config/db");
const redisClient = require("../config/redis");
const pagination = require("../utils/pagination");

const createBusLocation = async (req, res, next) => {
  try {
    if (
      !["admin", "school", "supervisor", "school_staff"].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school, supervisor and school staff can add locations",
      });
    }

    const { bus_id, latitude, longitude } = req.body;

    const requiredFields = { bus_id, latitude, longitude };
    for (let i in requiredFields) {
      if (!requiredFields[i]) {
        return res.status(400).json({
          success: false,
          message: `${i.charAt(0).toUpperCase() + i.slice(1)} is required`,
        });
      }
    }

    const bus = await pool.query("SELECT * FROM Bus WHERE id = $1", [bus_id]);
    if (bus.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Bus not found",
      });
    }

    const result = await pool.query(
      `INSERT INTO BusLocation (bus_id, latitude, longitude)
       VALUES ($1, $2, $3)
       RETURNING *;`,
      [bus_id, latitude, longitude]
    );

    return res.status(201).json({
      success: true,
      message: "Bus location recorded successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating bus location:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAllBusLocations = async (req, res, next) => {
  try {
    if (!["admin", "school", "school_staff"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school and school staff can view all bus locations",
      });
    }

    const { page, limit, skip } = pagination(req);
    const cacheKey = `bus_locations_page_${page}_limit_${limit}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log("Retrieved bus locations from cache");
      return res.status(200).json(JSON.parse(cached));
    }

    const result = await pool.query(
      `SELECT * FROM BusLocation ORDER BY recorded_at DESC LIMIT $1 OFFSET $2`,
      [limit, skip]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No bus locations found",
      });
    }

    const response = {
      success: true,
      total: result.rows.length,
      data: result.rows,
    };

    await redisClient.setEx(cacheKey, 3600, JSON.stringify(response));

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching bus locations:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getBusLocationById = async (req, res, next) => {
  try {
    if (
      !["admin", "school", "supervisor", "school_staff"].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school, supervisor and school staff can add locations",
      });
    }

    const { id } = req.params;
    const result = await pool.query("SELECT * FROM BusLocation WHERE id = $1", [
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Bus location not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching bus location by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getLocationsByBus = async (req, res, next) => {
  try {
    if (
      !["admin", "school", "supervisor", "school_staff"].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school, supervisor and school staff can add locations",
      });
    }

    const { bus_id } = req.params;
    const { page, limit, skip } = pagination(req);

    const bus = await pool.query("SELECT * FROM Bus WHERE id = $1", [bus_id]);
    if (bus.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Bus not found",
      });
    }

    const result = await pool.query(
      `SELECT * FROM BusLocation WHERE bus_id = $1 ORDER BY recorded_at DESC LIMIT $2 OFFSET $3`,
      [bus_id, limit, skip]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No locations found for this bus",
      });
    }

    return res.status(200).json({
      success: true,
      total: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching bus locations by bus:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updateBusLocationById = async (req, res, next) => {
  try {
    if (
      !["admin", "school", "supervisor", "school_staff"].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school, supervisor and school staff can update locations",
      });
    }
    const { id } = req.params;
    const { latitude, longitude, passenger_count, route_name } = req.body;

    const updates = [];
    const values = [];

    if (latitude !== undefined) {
      updates.push(`latitude = $${updates.length + 1}`);
      values.push(latitude);
    }
    if (longitude !== undefined) {
      updates.push(`longitude = $${updates.length + 1}`);
      values.push(longitude);
    }
    if (passenger_count !== undefined) {
      updates.push(`passenger_count = $${updates.length + 1}`);
      values.push(passenger_count);
    }
    if (route_name !== undefined) {
      updates.push(`route_name = $${updates.length + 1}`);
      values.push(route_name);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE BusLocation
       SET ${updates.join(", ")}
       WHERE id = $${values.length}
       RETURNING *;`,
      values
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Bus location not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Bus location updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating bus location:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const deleteBusLocationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM BusLocation WHERE id = $1 RETURNING *;",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Bus location not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Bus location deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting bus location:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteAllBusLocations = async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM BusLocation;");
    return res.status(200).json({
      success: true,
      message: "All bus locations deleted successfully",
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Error deleting all bus locations:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createBusLocation,
  getAllBusLocations,
  getBusLocationById,
  getLocationsByBus,
  updateBusLocationById,
  deleteBusLocationById,
  deleteAllBusLocations,
};
