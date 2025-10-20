const { Router } = require("express");
const {
  createStudent,
  getAllStudents,
  getStudentById,
  updateStudentById,
  deleteStudentById,
  deleteAllStudents,
} = require("../controllers/student");

const router = Router();

router.post("/create", createStudent);
router.get("/get/:id", getStudentById);
router.get("/getAll", getAllStudents);
router.patch("/update/:id", updateStudentById);
router.delete("/delete/:id", deleteStudentById);
router.delete("/deleteAll", deleteAllStudents);

module.exports = router;
