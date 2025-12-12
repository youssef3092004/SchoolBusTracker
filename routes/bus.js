const { Router } = require("express");
const {
  createBus,
  getAllBuses,
  getBusById,
  updateBusById,
  deleteBusById,
  deleteAllBuses,
  getBusesBySchool,
  getBusesBySupervisor,
} = require("../controllers/bus");
const validateToken = require("../utils/verifyToken");
const checkPermission = require("../middleware/checkPermission");

const router = Router();

router.post("/create", validateToken, checkPermission("create_bus"), createBus);
router.get(
  "/getAll",
  validateToken,
  checkPermission("view_all_buses"),
  getAllBuses
);
router.get("/get/:id", validateToken, checkPermission("view_bus"), getBusById);
router.patch(
  "/update/:id",
  validateToken,
  checkPermission("update_bus"),
  updateBusById
);
router.delete(
  "/delete/:id",
  validateToken,
  checkPermission("delete_bus"),
  deleteBusById
);
router.delete(
  "/deleteAll",
  validateToken,
  checkPermission("delete_all_buses"),
  deleteAllBuses
);
router.get(
  "/school/:school_id",
  validateToken,
  checkPermission("view_buses_by_school"),
  getBusesBySchool
);
router.get(
  "/supervisor/:supervisor_id",
  validateToken,
  checkPermission("view_buses_by_supervisor"),
  getBusesBySupervisor
);

module.exports = router;
