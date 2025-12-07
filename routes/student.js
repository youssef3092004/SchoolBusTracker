const { Router } = require("express");
const {
  createStudent,
  getAllStudents,
  getStudentById,
  updateStudentById,
  deleteStudentById,
  deleteAllStudents,
} = require("../controllers/student");
const validateToken = require("../utils/verifyToken");
const checkPermission = require("../middleware/checkPermission");

const router = Router();

router.post(
  "/create",
  validateToken,
  checkPermission("create_student"),
  createStudent
);
router.get(
  "/get/:id",
  validateToken,
  checkPermission("view_student"),
  getStudentById
);
router.get(
  "/getAll",
  validateToken,
  checkPermission("view_all_students"),
  getAllStudents
);
router.patch(
  "/update/:id",
  validateToken,
  checkPermission("update_student"),
  updateStudentById
);
router.delete(
  "/delete/:id",
  validateToken,
  checkPermission("delete_student"),
  deleteStudentById
);
router.delete(
  "/deleteAll/:school_id",
  validateToken,
  checkPermission("delete_all_students"),
  deleteAllStudents
);

module.exports = router;
