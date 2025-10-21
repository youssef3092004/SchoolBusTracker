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

const router = Router();

router.post("/create", validateToken, createBus);
router.get("/getAll", validateToken, getAllBuses);
router.get("/get/:id", validateToken, getBusById);
router.patch("/update/:id", validateToken, updateBusById);
router.delete("/delete/:id", validateToken, deleteBusById);
router.delete("/deleteAll", validateToken, deleteAllBuses);
router.get("/school/:school_id", validateToken, getBusesBySchool);
router.get("/supervisor/:supervisor_id", validateToken, getBusesBySupervisor);

module.exports = router;
