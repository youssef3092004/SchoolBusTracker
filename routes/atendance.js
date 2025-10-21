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

const router = Router();

router.post("/create", validateToken, createAttendance);
router.get("/getAll", validateToken, getAllAttendance);
router.get("/get/:id", validateToken, getAttendanceById);
router.patch("/update/:id", validateToken, updateAttendanceById);
router.delete("/delete/:id", validateToken, deleteAttendanceById);
router.delete("/deleteAll", validateToken, deleteAllAttendance);
router.get("/student/:student_id", validateToken, getAttendanceByStudent);
router.get("/date/:date", validateToken, getAttendanceByDate);
router.get("/summary/:student_id", validateToken, getAttendanceSummary);

module.exports = router;
