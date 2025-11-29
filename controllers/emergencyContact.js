const pool = require("../config/db");
const redisClient = require("../config/redis");
const pagination = require("../utils/pagination");

const createEmergencyContact = async (req, res, next) => {
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
          "Access denied: only admin, school, parent and school staff can create emergency contacts",
      });
    }

    const { student_id, name, relationship, phone, email } = req.body;

    const requiredFields = { student_id, name, relationship, phone };
    for (let i in requiredFields) {
      if (!requiredFields[i]) {
        return res.status(400).json({
          success: false,
          message: `${i.charAt(0).toUpperCase() + i.slice(1)} is required`,
        });
      }
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
      INSERT INTO EmergencyContact (student_id, name, relationship, phone, email)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
      `,
      [student_id, name, relationship, phone, email || null]
    );

    return res.status(201).json({
      success: true,
      message: "Emergency contact created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating emergency contact:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAllEmergencyContacts = async (req, res, next) => {
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
          "Access denied: only admin, school staff, and parents can view emergency contacts",
      });
    }

    const { page, limit, skip } = pagination(req);

    const cacheKey = `emergency_contacts_page_${page}_limit_${limit}`;
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      console.log("Retrieved emergency contacts from cache");
      return res.status(200).json(JSON.parse(cachedData));
    }

    const result = await pool.query(
      `SELECT * FROM EmergencyContact ORDER BY created_at DESC LIMIT $1 OFFSET $2;`,
      [limit, skip]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No emergency contacts found",
      });
    }

    console.log("Storing emergency contacts in cache");
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
    console.error("Error fetching emergency contacts:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getEmergencyContactById = async (req, res, next) => {
  try {
    if (
      !["admin", "school", "school_staff", "parent"].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school, staff, or parent can view emergency contact",
      });
    }

    const { id } = req.params;

    const result = await pool.query(
      "SELECT * FROM EmergencyContact WHERE id = $1;",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Emergency contact not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching emergency contact by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getEmergencyContactsByStudent = async (req, res, next) => {
  try {
    if (
      !["admin", "school", "school_staff", "parent"].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school, staff, or parent can view emergency contact",
      });
    }

    const { id } = req.params;
    const { page, limit, skip } = pagination(req);

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

    const cacheKey = `emergency_contacts_student_${id}_page_${page}_limit_${limit}`;
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      console.log("Retrieved emergency contacts from cache");
      return res.status(200).json(JSON.parse(cachedData));
    }

    const result = await pool.query(
      `SELECT * FROM EmergencyContact WHERE student_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3;`,
      [id, limit, skip]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No emergency contacts found for this student",
      });
    }

    console.log("Storing emergency contacts in cache");
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
    console.error("Error fetching emergency contacts by student:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updateEmergencyContactById = async (req, res, next) => {
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
          "Access denied: only admin, school, parent and school staff can update emergency contacts",
      });
    }
    const { id } = req.params;
    const { name, relationship, phone, email } = req.body;

    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push(`name = $${updates.length + 1}`);
      values.push(name);
    }
    if (relationship !== undefined) {
      updates.push(`relationship = $${updates.length + 1}`);
      values.push(relationship);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${updates.length + 1}`);
      values.push(phone);
    }
    if (email !== undefined) {
      updates.push(`email = $${updates.length + 1}`);
      values.push(email);
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
      UPDATE EmergencyContact
      SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING *;
      `,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Emergency contact not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Emergency contact updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating emergency contact:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteEmergencyContactById = async (req, res, next) => {
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
          "Access denied: only admin, school, parent and school staff can delete emergency contacts",
      });
    }

    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM EmergencyContact WHERE id = $1 RETURNING *;",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Emergency contact not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Emergency contact deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting emergency contact:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteAllEmergencyContacts = async (req, res, next) => {
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
          "Access denied: only admin, school, parent and school staff can delete all emergency contacts",
      });
    }
    const result = await pool.query("DELETE FROM EmergencyContact;");

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No emergency contacts found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "All emergency contacts deleted successfully",
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Error deleting all emergency contacts:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createEmergencyContact,
  getAllEmergencyContacts,
  getEmergencyContactById,
  getEmergencyContactsByStudent,
  updateEmergencyContactById,
  deleteEmergencyContactById,
  deleteAllEmergencyContacts,
};
