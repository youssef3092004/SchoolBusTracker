const { Router } = require("express");
const {
  registerSchool,
  loginSchool,
  logoutSchool,
  updateSchool,
  getSchoolById,
  getAllSchools,
  deleteSchoolById,
  deleteAllSchools,
} = require("../controllers/school");
const verifyToken = require("../utils/verifyToken");

const router = Router();

router.post("/register", verifyToken, registerSchool);
router.post("/login", loginSchool);
router.post("/logout", verifyToken, logoutSchool);
router.patch("/update", verifyToken, updateSchool);
router.get("/get/:id", verifyToken, getSchoolById);
router.get("/getAll", verifyToken, getAllSchools);
router.delete("/delete/:id", verifyToken, deleteSchoolById);
router.delete("/deleteAll", verifyToken, deleteAllSchools);

module.exports = router;
