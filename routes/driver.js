const { Router } = require("express");
const {
  createDriver,
  getAllDrivers,
  getDriverById,
  updateDriverById,
  deleteAllDrivers,
  deleteDriverById,
} = require("../controllers/driver");
const validateToken = require("../utils/verifyToken");

const router = Router();

router.post("/create", validateToken, createDriver);
router.get("/getAll", validateToken, getAllDrivers);
router.get("/get/:id", validateToken, getDriverById);
router.patch("/update/:id", validateToken, updateDriverById);
router.delete("/delete/:id", validateToken, deleteDriverById);
router.delete("/deleteAll", validateToken, deleteAllDrivers);

module.exports = router;
