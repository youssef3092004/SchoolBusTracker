const { Router } = require("express");
const {
  updateSupervisor,
  getSupervisorById,
  getAllSupervisors,
  deleteSupervisorById,
  deleteAllSupervisors,
} = require("../controllers/supervisor");
const verifyToken = require("../utils/verifyToken");
const checkPermission = require("../middleware/checkPermission");
const {
  registerSupervisor,
  loginSupervisor,
  logoutSupervisor,
} = require("../middleware/authSupervisor");
const router = Router();

router.post(
  "/register",
  verifyToken,
  checkPermission("create_supervisor"),
  registerSupervisor
);
router.post("/login", loginSupervisor);
router.post("/logout", verifyToken, logoutSupervisor);
router.patch(
  "/update/:supervisor_id",
  verifyToken,
  checkPermission("update_supervisor"),
  updateSupervisor
);
router.patch(
  "/update",
  verifyToken,
  checkPermission("update_supervisor"),
  updateSupervisor
);
router.get(
  "/get/:id",
  verifyToken,
  checkPermission("view_supervisor"),
  getSupervisorById
);
router.get(
  "/getAll",
  verifyToken,
  checkPermission("view_all_supervisors"),
  getAllSupervisors
);
router.delete(
  "/delete/:school_id",
  verifyToken,
  checkPermission("delete_supervisor"),
  deleteSupervisorById
);
router.delete(
  "/deleteAll/:school_id",
  verifyToken,
  checkPermission("delete_all_supervisors"),
  deleteAllSupervisors
);

module.exports = router;
