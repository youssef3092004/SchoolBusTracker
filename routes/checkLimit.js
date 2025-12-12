const { Router } = require("express");
const { getMaxLimitAndUsed } = require("../controllers/checkLimit");
const validateToken = require("../utils/verifyToken");

const router = Router();

router.get("/get/:school_id", validateToken, getMaxLimitAndUsed);

module.exports = router;
