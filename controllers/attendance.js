const pool = require("../config/db");
const redisClient = require("../config/redis");
const pagination = require("../utils/pagination");

const createAttendance = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "parent" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, parents, school staff can create attendance records",
      });
    }

    const { student_id, date, status, reported_by_parent } = req.body;

    const requiredFields = { student_id, date, status };
    for (let i in requiredFields) {
      if (!requiredFields[i]) {
        return res.status(400).json({
          success: false,
          message: `${i.charAt(0).toUpperCase() + i.slice(1)} is required`,
        });
      }
    }

    const studentCheck = await pool.query(
      `SELECT id FROM Student WHERE id = $1`,
      [student_id]
    );
    if (studentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const result = await pool.query(
      `INSERT INTO Attendance (student_id, date, status, reported_by_parent)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [student_id, date, status, reported_by_parent || false]
    );

    return res.status(201).json({
      success: true,
      message: "Attendance record created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating attendance:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAllAttendance = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "parent" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school staff, and parents can view attendance records",
      });
    }

    const { page, limit, skip } = pagination(req);

    const { status, student_id, date } = req.query;

    const cacheKey = `attendance:page=${page}:limit=${limit}:status=${
      status || "all"
    }:student=${student_id || "all"}:date=${date || "all"}`;

    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      console.log("Serving from Redis cache");
      return res.status(200).json(JSON.parse(cachedData));
    }

    let query = "SELECT * FROM Attendance WHERE 1=1";
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    if (student_id) {
      params.push(student_id);
      query += ` AND student_id = $${params.length}`;
    }

    if (date) {
      params.push(date);
      query += ` AND date = $${params.length}`;
    }

    const countQuery = `SELECT COUNT(*) FROM (${query}) AS total`;
    const totalResult = await pool.query(countQuery, params);
    const total = parseInt(totalResult.rows[0].count, 10);

    params.push(limit, skip);
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${
      params.length
    }`;

    const result = await pool.query(query, params);

    const responseData = {
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      count: result.rows.length,
      data: result.rows,
    };

    await redisClient.setEx(cacheKey, 3600, JSON.stringify(responseData));

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching attendance:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAttendanceById = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff" &&
      req.user.role !== "parent"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school staff, and parents can view attendance records",
      });
    }
    const { id } = req.params;

    const result = await pool.query(`SELECT * FROM Attendance WHERE id = $1`, [
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching attendance by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updateAttendanceById = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff" &&
      req.user.role !== "parent"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school staff, and parents can update attendance records",
      });
    }
    const { id } = req.params;
    const { status, reported_by_parent } = req.body;

    const updates = [];
    const values = [];

    if (status) {
      updates.push(`status = $${updates.length + 1}`);
      values.push(status);
    }

    if (reported_by_parent !== undefined) {
      updates.push(`reported_by_parent = $${updates.length + 1}`);
      values.push(reported_by_parent);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE Attendance
       SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Attendance record updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating attendance:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteAttendanceById = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school staff can delete attendance records",
      });
    }
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM Attendance WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Attendance record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting attendance:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteAllAttendance = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school staff can delete all attendance records",
      });
    }
    const result = await pool.query(`DELETE FROM Attendance`);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No attendance records found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "All attendance records deleted successfully",
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Error deleting all attendance:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAttendanceByStudent = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff" &&
      req.user.role !== "parent"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school staff, and parents can view attendance records",
      });
    }
    const { student_id } = req.params;

    const result = await pool.query(
      `SELECT * FROM Attendance WHERE student_id = $1 ORDER BY date DESC`,
      [student_id]
    );

    return res.status(200).json({
      success: true,
      total: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching attendance by student:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAttendanceByDate = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff" &&
      req.user.role !== "parent"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school staff, and parents can view attendance records",
      });
    }
    const { date } = req.params;

    const result = await pool.query(
      `SELECT * FROM Attendance WHERE date = $1`,
      [date]
    );

    return res.status(200).json({
      success: true,
      total: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching attendance by date:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAttendanceSummary = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff" &&
      req.user.role !== "parent"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school staff, and parents can view attendance records",
      });
    }
    const { student_id } = req.params;

    const result = await pool.query(
      `
      SELECT 
        status,
        COUNT(*) AS total
      FROM Attendance
      WHERE student_id = $1
      GROUP BY status
      `,
      [student_id]
    );

    return res.status(200).json({
      success: true,
      message: "Attendance summary fetched successfully",
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching attendance summary:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createAttendance,
  getAllAttendance,
  getAttendanceById,
  updateAttendanceById,
  deleteAttendanceById,
  deleteAllAttendance,
  getAttendanceByStudent,
  getAttendanceByDate,
  getAttendanceSummary,
};
