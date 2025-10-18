const { Router } = require("express");
const {
  registerAdmin,
  loginAdmin,
  logoutAdmin,
  updateAdmin,
  getAdminById,
  getAllAdmins,
  deleteAdminById,
  deleteAllAdmins,
} = require("../controllers/admin");
const verifyToken = require("../utils/verifyToken");

const router = Router();

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.post("/logout", verifyToken, logoutAdmin);
router.patch("/update", verifyToken, updateAdmin);
router.get("/get/:id", verifyToken, getAdminById);
router.get("/getAll", verifyToken, getAllAdmins);
router.delete("/delete/:id", verifyToken, deleteAdminById);
router.delete("/deleteAll", verifyToken, deleteAllAdmins);

module.exports = router;
