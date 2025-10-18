const pool = require("../config/db");
const pagination = require("../utils/pagination");
const redis = require("../config/redis");

const createPlan = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can create a plan",
      });
    }
    const {
      name,
      max_students,
      max_parent,
      max_supervisor,
      price,
      description,
    } = req.body;
    const requiredFields = {
      name,
      max_students,
      max_parent,
      max_supervisor,
      price,
      description,
    };

    for (let i in requiredFields) {
      if (!requiredFields[i]) {
        return res.status(400).json({
          success: false,
          message: `${i.charAt(0).toUpperCase() + i.slice(1)} is required`,
        });
      }
    }

    const existingPlan = await pool.query(
      "SELECT * FROM Plan WHERE name = $1",
      [name]
    );
    if (existingPlan.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Plan with this name already exists",
      });
    }

    const newPlan = await pool.query(
      "INSERT INTO Plan (name, max_students, max_parent, max_supervisor, price, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [name, max_students, max_parent, max_supervisor, price, description]
    );
    return res.status(201).json({
      success: true,
      message: "Plan created successfully",
      plan: newPlan.rows[0],
    });
  } catch (error) {
    console.error("Error creating plan:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getPlanById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can view plan details",
      });
    }
    const id = req.params.id;
    const result = await pool.query("SELECT * FROM Plan WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    return res.status(200).json({
      success: true,
      plan: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching plan:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAllPlans = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can view all plans",
      });
    }

    const { page, limit, skip } = pagination(req);

    const cacheKey = `plans:${page}:${limit}`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log("Returning data from Redis cache");
      return res.status(200).json(JSON.parse(cachedData));
    }

    const countResult = await pool.query("SELECT COUNT(*) AS total FROM Plan");
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    const result = await pool.query(
      "SELECT * FROM Plan ORDER BY CREATED_AT DESC LIMIT $1 OFFSET $2",
      [limit, skip]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No plans found",
      });
    }
    const responseData = {
      success: true,
      page: page,
      limit: limit,
      totalPages: totalPages,
      data: result.rows,
    };

    console.log("Storing data in Redis cache");
    await redis.set(cacheKey, JSON.stringify(responseData));

    return res.status(200).json({ responseData });
  } catch (error) {
    console.error("Error fetching plans:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updatePlanById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can update plans",
      });
    }

    const planId = req.params.id;
    const allowedFields = [
      "name",
      "max_students",
      "max_parent",
      "max_supervisor",
      "price",
      "description",
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
    values.push(planId);

    const query = `
      UPDATE Plan
      SET ${setClause}
      WHERE id = $${values.length}
      RETURNING id, name, max_students, max_parent, max_supervisor, price, description, updated_at;
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Plan updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating plan:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deletePlanById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can delete a plan",
      });
    }
    const id = req.params.id;

    const result = await pool.query(
      "DELETE FROM Plan WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Plan not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Plan deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting plan:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteAllPlans = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can delete plans",
      });
    }

    const result = await pool.query("DELETE FROM Plan RETURNING *");

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No plans found to delete.",
      });
    }

    res.status(200).json({
      success: true,
      message: "All plans deleted successfully.",
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Error deleting plans:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createPlan,
  getPlanById,
  getAllPlans,
  updatePlanById,
  deletePlanById,
  deleteAllPlans,
};
