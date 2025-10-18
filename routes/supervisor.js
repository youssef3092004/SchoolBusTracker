const { Router } = require("express");
const {
  registerSupervisor,
  loginSupervisor,
  logoutSupervisor,
  updateSupervisor,
  getSupervisorById,
  getAllSupervisors,
  deleteSupervisorById,
  deleteAllSupervisors,
} = require("../controllers/supervisor");
const verifyToken = require("../utils/verifyToken");

const router = Router();

router.post("/register", verifyToken, registerSupervisor);
router.post("/login", loginSupervisor);
router.post("/logout", verifyToken, logoutSupervisor);
router.patch("/update", verifyToken, updateSupervisor);
router.get("/get/:id", verifyToken, getSupervisorById);
router.get("/getAll", verifyToken, getAllSupervisors);
router.delete("/delete/:id", verifyToken, deleteSupervisorById);
router.delete("/deleteAll", verifyToken, deleteAllSupervisors);

module.exports = router;
