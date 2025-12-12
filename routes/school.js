const { Router } = require("express");
const {
  updateSchool,
  getSchoolById,
  getAllSchools,
  deleteSchoolById,
  deleteAllSchools,
} = require("../controllers/school");
const {
  registerSchool,
  loginSchool,
  logoutSchool,
} = require("../middleware/authSchool");
const verifyToken = require("../utils/verifyToken");
const checkPermission = require("../middleware/checkPermission");

const router = Router();

router.post(
  "/register",
  verifyToken,
  checkPermission("create_school"),
  registerSchool
);
router.post("/login", loginSchool);
router.post("/logout", verifyToken, logoutSchool);
router.patch(
  "/update",
  verifyToken,
  checkPermission("update_school"),
  updateSchool
);
router.get(
  "/get/:id",
  verifyToken,
  checkPermission("view_school"),
  getSchoolById
);
router.get(
  "/getAll",
  verifyToken,
  checkPermission("view_all_schools"),
  getAllSchools
);
router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission("delete_school"),
  deleteSchoolById
);
router.delete(
  "/deleteAll",
  verifyToken,
  checkPermission("delete_all_schools"),
  deleteAllSchools
);

module.exports = router;
