const { Router } = require("express");
const {
  getSchoolStaffById,
  getAllSchoolStaff,
  updateSchoolStaffById,
  deleteSchoolStaffById,
  deleteAllSchoolStaff,
} = require("../controllers/schoolStaff");
const { register, login, logout } = require("../middleware/authSchoolStaff");
const verifyToken = require("../utils/verifyToken");
const checkPermission = require("../middleware/checkPermission");

const router = Router();

router.post(
  "/register",
  verifyToken,
  checkPermission("create_school_staff"),
  register
);
router.post("/login", login);
router.post("/logout", verifyToken, logout);
router.get(
  "/get/:id",
  verifyToken,
  checkPermission("view_school_staff"),
  getSchoolStaffById
);
router.get(
  "/getAll",
  verifyToken,
  checkPermission("view_all_school_staff"),
  getAllSchoolStaff
);
router.patch(
  "/update/:id",
  verifyToken,
  checkPermission("update_school_staff"),
  updateSchoolStaffById
);
router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission("delete_school_staff"),
  deleteSchoolStaffById
);
router.delete(
  "/deleteAll/:school_id",
  verifyToken,
  checkPermission("delete_all_school_staff"),
  deleteAllSchoolStaff
);

module.exports = router;
