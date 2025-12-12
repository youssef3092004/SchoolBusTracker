const { Router } = require("express");
const {
  createBusLocation,
  getAllBusLocations,
  getBusLocationById,
  getLocationsByBus,
  updateBusLocationById,
  deleteBusLocationById,
  deleteAllBusLocations,
  startRealtimeLocationListener,
  stopRealtimeLocationListener,
} = require("../controllers/busLocation");
const validateToken = require("../utils/verifyToken");
const checkPermission = require("../middleware/checkPermission");

const router = Router();

router.post(
  "/create",
  validateToken,
  checkPermission("create_bus_location"),
  createBusLocation
);
router.get(
  "/getAll",
  validateToken,
  checkPermission("view_all_bus_locations"),
  getAllBusLocations
);
router.get(
  "/get/:id",
  validateToken,
  checkPermission("view_bus_location"),
  getBusLocationById
);
router.get(
  "/bus/:bus_id",
  validateToken,
  checkPermission("view_locations_by_bus"),
  getLocationsByBus
);
router.patch(
  "/update/:id",
  validateToken,
  checkPermission("update_bus_location"),
  updateBusLocationById
);
router.delete(
  "/delete/:id",
  validateToken,
  checkPermission("delete_bus_location"),
  deleteBusLocationById
);
router.delete(
  "/deleteAll",
  validateToken,
  checkPermission("delete_all_bus_locations"),
  deleteAllBusLocations
);

router.post(
  "/startRealtimeListener/:bus_id",
  validateToken,
  checkPermission("start_realtime_location_listener"),
  startRealtimeLocationListener
);

router.post(
  "/stopRealtimeListener/:bus_id",
  validateToken,
  checkPermission("stop_realtime_location_listener"),
  stopRealtimeLocationListener
);

module.exports = router;
