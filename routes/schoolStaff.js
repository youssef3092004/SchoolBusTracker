const { Router } = require("express");
const {
  register,
  login,
  logout,
  getSchoolStaffById,
  getAllSchoolStaff,
  updateSchoolStaffById,
  deleteSchoolStaffById,
  deleteAllSchoolStaff,
} = require("../controllers/schoolStaff");
const verifyToken = require("../utils/verifyToken");

const router = Router();

router.post("/register", verifyToken, register);
router.post("/login", login);
router.post("/logout", verifyToken, logout);
router.get("/get/:id", verifyToken, getSchoolStaffById);
router.get("/getAll", verifyToken, getAllSchoolStaff);
router.patch("/update/:id", verifyToken, updateSchoolStaffById);
router.delete("/delete/:id", verifyToken, deleteSchoolStaffById);
router.delete("/deleteAll", verifyToken, deleteAllSchoolStaff);

module.exports = router;
