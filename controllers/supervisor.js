const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const pagination = require("../utils/pagination");
const redis = require("../config/redis");

const registerSupervisor = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only school or admin can register a supervisor",
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
          message:
            "Access denied: cannot register supervisor for another school",
        });
      }

      const existSupervisor = await pool.query(
        `
            INSERT INTO Supervisor (name, school_id, governorate)
            VALUES ($1, $2, $3)
            RETURNING id, name, default_email, password, created_at;
            `,
        [name, school_id, governorate]
      );

      const supervisor = existSupervisor.rows[0];

      const { id, password } = supervisor;
      const passwordHashed = await bcrypt.hash(password, 10);

      await pool.query(`UPDATE Supervisor SET password = $1 WHERE id = $2`, [
        passwordHashed,
        id,
      ]);

      supervisor.password = passwordHashed;

      return res.status(201).json({
        success: true,
        message: "Supervisor registered successfully",
        supervisor: supervisor,
      });
    }
  } catch (error) {
    console.error("Error registering supervisor:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const loginSupervisor = async (req, res, next) => {
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

    const existSupervisor = await pool.query(
      "SELECT * FROM Supervisor WHERE default_email = $1",
      [email]
    );

    if (existSupervisor.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const supervisor = existSupervisor.rows[0];

    const isPasswordValid = await bcrypt.compare(password, supervisor.password);
    if (!isPasswordValid) {
      console.log("Invalid password attempt for supervisor:", email);
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        id: supervisor.id,
        role: "supervisor",
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: token,
    });
  } catch (error) {
    console.error("Error during supervisor login:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const logoutSupervisor = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token is required for logout",
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
    console.error("Error occurred during logout:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updateSupervisor = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "supervisor"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school or the supervisor can update supervisor details",
      });
    }

    const supervisorId = req.user.id;

    const allowedFields = [
      "name",
      "phone",
      "address",
      "email",
      "password",
      "governorate",
      "language",
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

    values.push(supervisorId);

    const query = `
      UPDATE Supervisor
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
      message: "Supervisor updated successfully",
      supervisor: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating supervisor:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getSupervisorById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin or school can view supervisor details",
      });
    }

    const supervisorId = req.params.id;

    const result = await pool.query(
      "SELECT id, name, address, phone, email, governorate, created_at, updated_at FROM Supervisor WHERE id = $1",
      [supervisorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Supervisor not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Supervisor fetched successfully",
      supervisor: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching supervisor by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAllSupervisors = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin or school can view all supervisors",
      });
    }

    const { page, limit, skip } = pagination(req);
    const cacheKey = `supervisors:${page}:${limit}`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log(" Returning data from Redis cache");
      return res.status(200).json({ cachedData: JSON.parse(cachedData) });
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM Supervisor`);
    const totalRecords = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalRecords / limit);

    const result = await pool.query(
      `SELECT id, name, address, phone, email, governorate, created_at, updated_at FROM Supervisor ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, skip]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No supervisors found",
      });
    }

    const responseData = {
      success: true,
      page: page,
      limit: limit,
      totalPages: totalPages,
      data: result.rows,
    };
    console.log("Saving data to Redis cache");
    await redis.set(cacheKey, JSON.stringify(responseData));

    return res.status(200).json({ responseData });
  } catch (error) {
    console.error("Error fetching all supervisors:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteSupervisorById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin or school can delete a supervisor",
      });
    }

    const supervisorId = req.params.id;

    const result = await pool.query(
      "DELETE FROM Supervisor WHERE id = $1 RETURNING id",
      [supervisorId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Supervisor not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Supervisor deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting supervisor:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteAllSupervisors = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin or school can delete all supervisors",
      });
    }

    const result = await pool.query("DELETE FROM Supervisor RETURNING id");

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No supervisors found to delete",
      });
    }

    return res.status(200).json({
      success: true,
      message: "All supervisors deleted successfully",
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Error deleting all supervisors:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  registerSupervisor,
  loginSupervisor,
  logoutSupervisor,
  updateSupervisor,
  getSupervisorById,
  getAllSupervisors,
  deleteSupervisorById,
  deleteAllSupervisors,
};
