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

const router = Router();

router.post("/create", validateToken, createStudent);
router.get("/get/:id", validateToken, getStudentById);
router.get("/getAll", validateToken, getAllStudents);
router.patch("/update/:id", validateToken, updateStudentById);
router.delete("/delete/:id", validateToken, deleteStudentById);
router.delete("/deleteAll", validateToken, deleteAllStudents);

module.exports = router;
