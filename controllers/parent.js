const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const pagination = require("../utils/pagination");
const redis = require("../config/redis");

const registerParent = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only school or admin can register a parent",
      });
    }

    const { name, school_id, governorate } = req.body;

    const requiredFields = { name, school_id, governorate };

    for (let i in requiredFields) {
      if (!requiredFields[i]) {
        return res.status(400).json({
          success: false,
          message: `${i.charAt(0).toUpperCase() + i.slice(1)} is required`,
        });
      }
    }

    if (req.user.role === "school") {
      const schoolCheck = await pool.query(
        "SELECT * FROM School WHERE id = $1",
        [req.user.id]
      );
      if (
        schoolCheck.rows.length === 0 ||
        schoolCheck.rows[0].id !== school_id
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied: cannot register parent for another school",
        });
      }
    }

    const existParent = await pool.query(
      `
      INSERT INTO Parent (name, school_id, governorate)
      VALUES ($1, $2, $3)
      RETURNING id, name, default_email, password, created_at;
      `,
      [name, school_id, governorate]
    );

    const parent = existParent.rows[0];

    const passwordHashed = await bcrypt.hash(parent.password, 10);

    await pool.query(
      `
      UPDATE Parent
      SET password = $1
      WHERE id = $2
      `,
      [passwordHashed, parent.id]
    );

    parent.password = passwordHashed;

    res.status(201).json({
      message: "Parent registered successfully",
      parent: parent,
    });
  } catch (err) {
    console.error("Error creating parent:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const loginParent = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    const existParent = await pool.query(
      "SELECT * FROM Parent WHERE default_email = $1",
      [email]
    );

    if (existParent.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }
    const parent = existParent.rows[0];

    const isPasswordValid = await bcrypt.compare(password, parent.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid password or email",
      });
    }

    const token = jwt.sign(
      {
        id: parent.id,
        role: "parent",
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
    });
  } catch (error) {
    console.error("Error occurred during login:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const logoutParent = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token is required",
      });
    }
    const decoded = jwt.decode(token);
    if (!decoded) {
      return res.status(400).json({
        success: false,
        message: "Invalid token",
      });
    }

    await pool.query(
      "INSERT INTO BlackList (token, expired_at) VALUES ($1, $2)",
      [token, new Date(decoded.exp * 1000)]
    );

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Error during parent logout:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updateParent = async (req, res, next) => {
  try {
    if (
      req.user.role !== "school" &&
      req.user.role !== "admin" &&
      req.user.role !== "parent"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin or school or parent can update a parent",
      });
    }

    const parentId = req.user.id;
    const allowedFields = [
      "name",
      "address",
      "phone",
      "email",
      "password",
      "governorate",
      "language",
      "relationship",
      "latitude",
      "longitude",
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

    values.push(parentId);

    const query = `
      UPDATE Parent
      SET ${setClause}
      WHERE id = $${values.length}
      RETURNING id, name, address, phone, email, governorate, updated_at;
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Parent updated successfully",
      school: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating parent:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getParentById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin or school can view parent details",
      });
    }

    const parentId = req.params.id;

    const result = await pool.query(
      `
      SELECT id, name, address, phone, email, governorate, updated_at
      FROM Parent
      WHERE id = $1
      `,
      [parentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Parent retrieved successfully",
      parent: result.rows[0],
    });
  } catch (error) {
    console.error("Error retrieving parent:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAllParents = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const { page, limit, skip } = pagination(req);

    const cacheKey = `parents:${page}:${limit}`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log("Returning data from Redis cache");
      return res.status(200).json(JSON.parse(cachedData));
    }

    const countResult = await pool.query(
      "SELECT COUNT(*) AS total FROM Parent"
    );
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    const result = await pool.query(
      `
      SELECT id, name, address, phone, email, governorate, created_at, updated_at
      FROM Parent
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, skip]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No parents found",
      });
    }

    const responseData = {
      success: true,
      page: page,
      limit: limit,
      totalPages: totalPages,
      parents: result.rows,
    };

    await redis.setEx(cacheKey, 3600, JSON.stringify(responseData));

    return res.status(200).json({ responseData });
  } catch (error) {
    console.error("Error retrieving parents:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteParentById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const parentId = req.params.id;

    const result = await pool.query(
      `
      DELETE FROM Parent
      WHERE id = $1
      RETURNING id, name
      `,
      [parentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Parent deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting parent:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteAllParents = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM Parent
      RETURNING id, name
      `
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No parents found to delete",
      });
    }

    return res.status(200).json({
      success: true,
      message: "All parents deleted successfully",
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Error deleting all parents:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  registerParent,
  loginParent,
  logoutParent,
  updateParent,
  getParentById,
  getAllParents,
  deleteParentById,
  deleteAllParents,
};
