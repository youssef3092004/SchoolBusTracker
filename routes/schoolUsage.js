const { Router } = require("express");
const {
  createSchoolUsage,
  getSchoolUsage,
  getSchoolUsageById,
} = require("../controllers/schoolUsage");
const verifyToken = require("../utils/verifyToken");
const checkPermission = require("../middleware/checkPermission");

const router = Router();

router.post(
  "/create/:school_id",
  verifyToken,
  checkPermission("create_school_usage"),
  createSchoolUsage
);
router.get(
  "/get/:school_id",
  verifyToken,
  checkPermission("view_school_usage"),
  getSchoolUsage
);

router.get(
  "/getById/:school_id",
  verifyToken,
  checkPermission("view_school_usage"),
  getSchoolUsageById
);

module.exports = router;
