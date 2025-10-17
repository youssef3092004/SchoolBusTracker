const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "authorization denied: No token provided",
      });
    }

    const existBlackList = await pool.query(
      "SELECT * FROM BlackList WHERE token = $1",
      [token]
    );

    if (existBlackList.rows.length > 0) {
      return res.status(401).json({
        success: false,
        message: "authorization denied: Token is Expired",
      });
    }
      
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Error verifying token:", error);
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid token",
    });
  }
};

module.exports = verifyToken;
