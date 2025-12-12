const { Router } = require("express");
const {
  createAttendance,
  getAllAttendance,
  getAttendanceById,
  updateAttendanceById,
  deleteAttendanceById,
  deleteAllAttendance,
  getAttendanceByStudent,
  getAttendanceByDate,
  getAttendanceSummary,
} = require("../controllers/attendance");
const validateToken = require("../utils/verifyToken");
const checkPermission = require("../middleware/checkPermission");

const router = Router();

router.post(
  "/create",
  validateToken,
  checkPermission("create_attendance"),
  createAttendance
);
router.get(
  "/getAll",
  validateToken,
  checkPermission("view_all_attendance"),
  getAllAttendance
);
router.get(
  "/get/:id",
  validateToken,
  checkPermission("view_attendance"),
  getAttendanceById
);
router.patch(
  "/update/:id",
  validateToken,
  checkPermission("update_attendance"),
  updateAttendanceById
);
router.delete(
  "/delete/:id",
  validateToken,
  checkPermission("delete_attendance"),
  deleteAttendanceById
);
router.delete(
  "/deleteAll",
  validateToken,
  checkPermission("delete_all_attendance"),
  deleteAllAttendance
);
router.get(
  "/student/:student_id",
  validateToken,
  checkPermission("view_attendance_by_student"),
  getAttendanceByStudent
);
router.get(
  "/date/:date",
  validateToken,
  checkPermission("view_attendance_by_date"),
  getAttendanceByDate
);
router.get(
  "/summary/:student_id",
  validateToken,
  checkPermission("view_attendance_summary"),
  getAttendanceSummary
);

module.exports = router;
