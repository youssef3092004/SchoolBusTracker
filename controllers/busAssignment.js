const pool = require("../config/db");
const redisClient = require("../config/redis");
const pagination = require("../utils/pagination");

const createBusAssignment = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "supervisor" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, supervisors, school staff can create attendance records",
      });
    }

    const { supervisor_id, student_id, route_name, pickup_time, dropoff_time } =
      req.body;

    const requiredFields = {
      supervisor_id,
      student_id,
      route_name,
      pickup_time,
      dropoff_time,
    };
    for (let i in requiredFields) {
      if (!requiredFields[i]) {
        return res.status(400).json({
          success: false,
          message: `${i.charAt(0).toUpperCase() + i.slice(1)} is required`,
        });
      }
    }

    const existSupervisor = await pool.query(
      "SELECT * FROM Supervisor WHERE id = $1;",
      [supervisor_id]
    );

    if (existSupervisor.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Supervisor not found",
      });
    }

    const existStudent = await pool.query(
      "SELECT * FROM Student WHERE id = $1;",
      [student_id]
    );

    if (existStudent.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO BusAssignment (supervisor_id, student_id, route_name, pickup_time, dropoff_time)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
      `,
      [supervisor_id, student_id, route_name, pickup_time, dropoff_time]
    );

    return res.status(201).json({
      success: true,
      message: "Bus assignment created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating bus assignment:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAllBusAssignments = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school staff can create attendance records",
      });
    }
    const { page, limit, skip } = pagination(req);

    const cacheKey = `bus_assignments_page_${page}_limit_${limit}`;
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      console.log("Retrieved bus assignments from cache");
      return res.status(200).json(JSON.parse(cachedData));
    }

    const result = await pool.query(
      `SELECT * FROM BusAssignment ORDER BY created_at DESC limit $1 offset $2;`,
      [limit, skip]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No bus assignments found",
      });
    }

    console.log("Storing bus assignments in cache");
    await redisClient.setEx(
      cacheKey,
      3600,
      JSON.stringify({
        success: true,
        total: result.rows.length,
        data: result.rows,
      })
    );

    return res.status(200).json({
      success: true,
      total: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching all bus assignments:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getBusAssignmentById = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "supervisor" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, supervisors, school staff can create attendance records",
      });
    }

    const { id } = req.params;

    const result = await pool.query(
      "SELECT * FROM BusAssignment WHERE id = $1;",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Bus assignment not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching bus assignment by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAssignmentsBySupervisor = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "supervisor" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, supervisors, school staff can create attendance records",
      });
    }
    const { id } = req.params;

    const existSupervisor = await pool.query(
      "SELECT * FROM Supervisor WHERE id = $1;",
      [id]
    );

    if (existSupervisor.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Supervisor not found",
      });
    }

    const result = await pool.query(
      "SELECT * FROM BusAssignment WHERE supervisor_id = $1 ORDER BY created_at DESC;",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No bus assignments found for this supervisor",
      });
    }

    return res.status(200).json({
      success: true,
      total: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching assignments by supervisor:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAssignmentsByStudent = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "supervisor" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, supervisors, school staff can create attendance records",
      });
    }
    const { id } = req.params;

    const existStudent = await pool.query(
      "SELECT * FROM Student WHERE id = $1;",
      [id]
    );

    if (existStudent.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const result = await pool.query(
      "SELECT * FROM BusAssignment WHERE student_id = $1 ORDER BY created_at DESC;",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No bus assignments found for this student",
      });
    }

    return res.status(200).json({
      success: true,
      total: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching assignments by student:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updateBusAssignmentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { supervisor_id, student_id, route_name, pickup_time, dropoff_time } =
      req.body;

    const updates = [];
    const values = [];

    if (supervisor_id !== undefined) {
      updates.push(`supervisor_id = $${updates.length + 1}`);
      values.push(supervisor_id);
    }
    if (student_id !== undefined) {
      updates.push(`student_id = $${updates.length + 1}`);
      values.push(student_id);
    }
    if (route_name !== undefined) {
      updates.push(`route_name = $${updates.length + 1}`);
      values.push(route_name);
    }
    if (pickup_time !== undefined) {
      updates.push(`pickup_time = $${updates.length + 1}`);
      values.push(pickup_time);
    }
    if (dropoff_time !== undefined) {
      updates.push(`dropoff_time = $${updates.length + 1}`);
      values.push(dropoff_time);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    values.push(id);

    const result = await pool.query(
      `
      UPDATE BusAssignment
      SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING *;
      `,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Bus assignment not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Bus assignment updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating bus assignment:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteBusAssignmentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM BusAssignment WHERE id = $1 RETURNING *;",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Bus assignment not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Bus assignment deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting bus assignment:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteAllBusAssignments = async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM BusAssignment;");

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No bus assignments found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "All bus assignments deleted successfully",
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Error deleting all bus assignments:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createBusAssignment,
  getAllBusAssignments,
  getBusAssignmentById,
  getAssignmentsBySupervisor,
  getAssignmentsByStudent,
  updateBusAssignmentById,
  deleteBusAssignmentById,
  deleteAllBusAssignments,
};
