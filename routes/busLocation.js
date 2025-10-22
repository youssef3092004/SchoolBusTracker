const { Router } = require("express");
const {
  createBusLocation,
  getAllBusLocations,
  getBusLocationById,
  getLocationsByBus,
  updateBusLocationById,
  deleteBusLocationById,
  deleteAllBusLocations,
} = require("../controllers/busLocation");
const validateToken = require("../utils/verifyToken");

const router = Router();

router.post("/create", validateToken, createBusLocation);
router.get("/getAll", validateToken, getAllBusLocations);
router.get("/get/:id", validateToken, getBusLocationById);
router.get("/bus/:bus_id", validateToken, getLocationsByBus);
router.patch("/update/:id", validateToken, updateBusLocationById);
router.delete("/delete/:id", validateToken, deleteBusLocationById);
router.delete("/deleteAll", validateToken, deleteAllBusLocations);

module.exports = router;
