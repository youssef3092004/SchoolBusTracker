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
const checkPermission = require("../middleware/checkPermission");

const router = Router();

router.post(
  "/create",
  validateToken,
  checkPermission("create_bus_assignment"),
  createBusAssignment
);
router.get(
  "/getAll",
  validateToken,
  checkPermission("view_all_bus_assignments"),
  getAllBusAssignments
);
router.get(
  "/get/:id",
  validateToken,
  checkPermission("view_bus_assignment"),
  getBusAssignmentById
);
router.patch(
  "/update/:id",
  validateToken,
  checkPermission("update_bus_assignment"),
  updateBusAssignmentById
);
router.delete(
  "/delete/:id",
  validateToken,
  checkPermission("delete_bus_assignment"),
  deleteBusAssignmentById
);
router.delete(
  "/deleteAll",
  validateToken,
  checkPermission("delete_all_bus_assignments"),
  deleteAllBusAssignments
);
router.get(
  "/supervisor/:id",
  validateToken,
  checkPermission("view_assignments_by_supervisor"),
  getAssignmentsBySupervisor
);
router.get(
  "/student/:id",
  validateToken,
  checkPermission("view_assignments_by_student"),
  getAssignmentsByStudent
);

module.exports = router;
