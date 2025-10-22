const { Router } = require("express");
const {
  createBusAssignment,
  getAllBusAssignments,
  getBusAssignmentById,
  getAssignmentsBySupervisor,
  getAssignmentsByStudent,
  updateBusAssignmentById,
  deleteBusAssignmentById,
  deleteAllBusAssignments,
} = require("../controllers/busAssignment");
const validateToken = require("../utils/verifyToken");

const router = Router();

router.post("/create", validateToken, createBusAssignment);
router.get("/getAll", validateToken, getAllBusAssignments);
router.get("/get/:id", validateToken, getBusAssignmentById);
router.patch("/update/:id", validateToken, updateBusAssignmentById);
router.delete("/delete/:id", validateToken, deleteBusAssignmentById);
router.delete("/deleteAll", validateToken, deleteAllBusAssignments);
router.get("/supervisor/:id", validateToken, getAssignmentsBySupervisor);
router.get("/student/:id", validateToken, getAssignmentsByStudent);

module.exports = router;
