const pool = require("../config/db");
const redisClient = require("../config/redis");
const pagination = require("../utils/pagination");

const createDriver = async (req, res) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school, school staff can create drivers",
      });
    }

    const { name, phone, email } = req.body;

    const requiredFields = { name, phone, email };
    for (let i in requiredFields) {
      if (!requiredFields[i]) {
        return res.status(400).json({
          success: false,
          message: `${i.charAt(0).toUpperCase() + i.slice(1)} is required`,
        });
      }
    }

    const existing = await pool.query(`SELECT * FROM Driver WHERE email = $1`, [
      email,
    ]);
    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Driver with this email already exists",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO Driver (name, phone, email)
      VALUES ($1, $2, $3)
      RETURNING *;
    `,
      [name, phone, email]
    );

    return res.status(201).json({
      success: true,
      message: "Driver created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating driver:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const getAllDrivers = async (req, res) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin and school staff can view drivers",
      });
    }

    const { page, limit, skip } = pagination(req);

    const cacheKey = `drivers:page=${page}:limit=${limit}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log("Serving from Redis cache");
      return res.status(200).json(JSON.parse(cached));
    }

    const params = [];
    let query = `SELECT * FROM Driver WHERE 1=1`;

    const countQuery = `SELECT COUNT(*) FROM (${query}) AS total`;
    const totalResult = await pool.query(countQuery, params);
    const total = parseInt(totalResult.rows[0].count, 10);

    params.push(limit, skip);
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${
      params.length
    }`;

    const result = await pool.query(query, params);

    const response = {
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      count: result.rows.length,
      data: result.rows,
    };

    await redisClient.setEx(cacheKey, 3600, JSON.stringify(response));
    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching drivers:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const getDriverById = async (req, res) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school, school staff can view drivers",
      });
    }

    const { id } = req.params;

    const cacheKey = `driver:${id}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log("Serving driver from Redis cache");
      return res.status(200).json(JSON.parse(cached));
    }

    const result = await pool.query(`SELECT * FROM Driver WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Driver not found" });
    }

    await redisClient.setEx(cacheKey, 3600, JSON.stringify(result.rows[0]));
    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error fetching driver:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const updateDriverById = async (req, res) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school and school staff can update drivers",
      });
    }

    const { id } = req.params;
    const { name, phone, email } = req.body;

    const updates = [];
    const values = [];

    if (name) {
      updates.push(`name = $${updates.length + 1}`);
      values.push(name);
    }

    if (phone) {
      updates.push(`phone = $${updates.length + 1}`);
      values.push(phone);
    }

    if (email) {
      updates.push(`email = $${updates.length + 1}`);
      values.push(email);
    }

    if (updates.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No valid fields provided" });
    }

    values.push(id);

    const result = await pool.query(
      `
      UPDATE Driver
      SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING *;
    `,
      values
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Driver not found" });
    }

    await redisClient.del(`driver:${id}`);
    await redisClient.flushAll();

    return res.status(200).json({
      success: true,
      message: "Driver updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating driver:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const deleteDriverById = async (req, res) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school and school staff can delete drivers",
      });
    }

    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM Driver WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Driver not found" });
    }

    await redisClient.del(`driver:${id}`);
    await redisClient.flushAll();

    return res.status(200).json({
      success: true,
      message: "Driver deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting driver:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const deleteAllDrivers = async (req, res) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school and school staff can delete all drivers",
      });
    }

    const result = await pool.query(`DELETE FROM Driver`);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No drivers found" });
    }
    await redisClient.flushAll();

    return res.status(200).json({
      success: true,
      message: "All drivers deleted successfully",
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Error deleting all drivers:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  createDriver,
  getAllDrivers,
  getDriverById,
  updateDriverById,
  deleteDriverById,
  deleteAllDrivers,
};
