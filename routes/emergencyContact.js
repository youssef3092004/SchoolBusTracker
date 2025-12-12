const { Router } = require("express");
const {
  createEmergencyContact,
  getAllEmergencyContacts,
  getEmergencyContactById,
  updateEmergencyContactById,
  deleteAllEmergencyContacts,
  deleteEmergencyContactById,
} = require("../controllers/emergencyContact");
const validateToken = require("../utils/verifyToken");
const checkPermission = require("../middleware/checkPermission");

const router = Router();

router.post(
  "/create",
  validateToken,
  checkPermission("create_emergency_contact"),
  createEmergencyContact
);
router.get(
  "/getAll",
  validateToken,
  checkPermission("view_all_emergency_contacts"),
  getAllEmergencyContacts
);
router.get(
  "/get/:id",
  validateToken,
  checkPermission("view_emergency_contact"),
  getEmergencyContactById
);
router.patch(
  "/update/:id",
  validateToken,
  checkPermission("update_emergency_contact"),
  updateEmergencyContactById
);
router.delete(
  "/deleteAll",
  validateToken,
  checkPermission("delete_all_emergency_contacts"),
  deleteAllEmergencyContacts
);
router.delete(
  "/delete/:id",
  validateToken,
  checkPermission("delete_emergency_contact"),
  deleteEmergencyContactById
);

module.exports = router;
