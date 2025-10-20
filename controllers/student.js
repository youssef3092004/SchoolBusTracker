const pool = require("../config/db");
const pagination = require("../utils/pagination");
const redisClient = require("../config/redis");

const createStudent = async (req, res) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin or school or school_staff can create students",
      });
    }
    const {
      parent_id,
      school_id,
      name,
      birthday,
      grade,
      class_name,
      image_url,
      address,
      parent_note,
    } = req.body;

    const requiredFields = { parent_id, school_id, name, birthday };

    for (let i in requiredFields) {
      if (!requiredFields[i]) {
        return res.status(400).json({
          success: false,
          message: `${i.charAt(0).toUpperCase() + i.slice(1)} is required`,
        });
      }
    }

    const school_name = await pool.query(
      `SELECT name FROM School WHERE id = $1`,
      [school_id]
    );

    if (school_name.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "School not found",
      });
    }

    const schoolName = school_name.rows[0].name;

    const firstCharWord = schoolName
      .split(/\s+/)
      .map((word) => word[0].toUpperCase())
      .join("");

    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const studentCode = `${firstCharWord}-${randomDigits}`;

    const result = await pool.query(
      `INSERT INTO Student 
  (parent_id, school_id, name, student_code, birthday, grade, class_name, image_url, address, parent_note)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  RETURNING *`,
      [
        parent_id,
        school_id,
        name,
        studentCode,
        birthday,
        grade || null,
        class_name || null,
        image_url || null,
        address || null,
        parent_note || null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Student created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating student:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAllStudents = async (req, res) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin or school or school_staff can view all students",
      });
    }
    const { page, limit, skip } = pagination(req);

    const cacheKey = `students_page_${page}_limit_${limit}`;
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      console.log("Returning from redis cache");
      return res.status(200).json({
        success: true,
        message: "Students fetched successfully",
        data: JSON.parse(cachedData),
      });
    }

    const result = await pool.query(
      `SELECT * FROM Student ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, skip]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No students found",
      });
    }
    console.log("Storing data in redis cache");
    await redisClient.set(cacheKey, JSON.stringify(result.rows));

    return res.status(200).json({
      success: true,
      total: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching students:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getStudentById = async (req, res) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin or school or school_staff can view student details",
      });
    }
    const id = req.params.id;
    const result = await pool.query("SELECT * FROM Student WHERE id = $1", [
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching student:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updateStudentById = async (req, res) => {
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
          "Access denied: only admin or school or parent can update students",
      });
    }
    const id = req.params.id;
    const allowFields = [
      "parent_id",
      "school_id",
      "name",
      "student_code",
      "birthday",
      "grade",
      "class_name",
      "image_url",
      "address",
      "parent_note",
    ];

    const updates = req.body;
    const keys = Object.keys(updates).filter((key) =>
      allowFields.includes(key)
    );

    if (keys.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid allowFields provided for update",
      });
    }

    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(", ");
    const values = keys.map((key) => updates[key]);
    values.push(id);

    const result = await pool.query(
      `UPDATE Student
       SET ${setClause}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating student:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteStudentById = async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin or school can delete students",
      });
    }
    const id = req.params.id;
    const result = await pool.query(
      `DELETE FROM Student WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting student:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteAllStudents = async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin or school can delete all students",
      });
    }
    const result = await pool.query("DELETE FROM Student");
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No students found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "All students deleted successfully",
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Error deleting all students:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createStudent,
  getAllStudents,
  getStudentById,
  updateStudentById,
  deleteStudentById,
  deleteAllStudents,
};
