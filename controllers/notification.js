const pool = require("../config/db");
const pagination = require("../utils/pagination");
const redisClient = require("../config/redis");

const createNotification = async (req, res, next) => {
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
          "Access denied: only admin or school or supervisor or school_staff can assign permissions",
      });
    }

    const { student_id, status, message } = req.body;

    if (!student_id) {
      return res.status(400).json({
        success: false,
        message: "Student id is required",
      });
    }
    if (!status) {
      //todo 'bus_departure', 'bus_arrival', 'child_boarding', 'delay', 'absence_reported'

      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }
    if (!message) {
      return res.status(400).json({
        success: false,
        message: "message is rqeuired",
      });
    }

    const result = await pool.query(
      `INSERT INTO Notification (student_id, status, message)
             VALUES ($1, $2, $3) RETURNING *`,
      [student_id, status, message]
    );

    return res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating notification:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getNotificationById = async (req, res, next) => {
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
          "Access denied: only admin or school or supervisor or school_staff can view notifications",
      });
    }

    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM Notification WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No notification found with this ID",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification fetched successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching notification by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAllNotifications = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin or school or school_staff can view all notifications",
      });
    }
    const { page, limit, skip } = pagination(req);

    const cacheKey = `notifications_page_${page}_limit_${limit}`;
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      return res.status(200).json({
        success: true,
        message: "Notifications fetched successfully from cache",
        data: JSON.parse(cachedData),
      });
    }

    const result = await pool.query(
      `SELECT * FROM Notification ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, skip]
    );

    await redisClient.set(cacheKey, JSON.stringify(result.rows));

    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updateNotificationById = async (req, res, next) => {
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
          "Access denied: only admin or school or school_staff or supervisor can update notifications",
      });
    }

    const { id } = req.params;
    const { student_id, status, message } = req.body;

    const existing = await pool.query(
      `SELECT * FROM Notification WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    const updated = await pool.query(
      `UPDATE Notification 
             SET student_id = $1, status = $2, message = $3
             WHERE id = $4
             RETURNING *`,
      [
        student_id || existing.rows[0].student_id,
        status || existing.rows[0].status,
        message || existing.rows[0].message,
        id,
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Notification updated successfully",
      data: updated.rows[0],
    });
  } catch (error) {
    console.error("Error updating notification:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteNotificationById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin or school can delete notifications",
      });
    }

    const { id } = req.params;

    const existing = await pool.query(
      `SELECT * FROM Notification WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await pool.query(`DELETE FROM Notification WHERE id = $1`, [id]);

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteAllNotifications = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin or school can delete all notifications",
      });
    }

    const result = await pool.query(`DELETE FROM Notification`);
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No notifications found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "All notifications have been deleted successfully",
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Error deleting all notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createNotification,
  getNotificationById,
  getAllNotifications,
  updateNotificationById,
  deleteNotificationById,
  deleteAllNotifications,
};
