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
const checkPermission = require("../middleware/checkPermission");

const router = Router();

router.post(
  "/create",
  validateToken,
  checkPermission("create_driver"),
  createDriver
);
router.get(
  "/getAll",
  validateToken,
  checkPermission("view_all_drivers"),
  getAllDrivers
);
router.get(
  "/get/:id",
  validateToken,
  checkPermission("view_driver"),
  getDriverById
);
router.patch(
  "/update/:id",
  validateToken,
  checkPermission("update_driver"),
  updateDriverById
);
router.delete(
  "/delete/:id",
  validateToken,
  checkPermission("delete_driver"),
  deleteDriverById
);
router.delete(
  "/deleteAll",
  validateToken,
  checkPermission("delete_all_drivers"),
  deleteAllDrivers
);

module.exports = router;
