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

const router = Router();

router.post("/create", validateToken, createEmergencyContact);
router.get("/getAll", validateToken, getAllEmergencyContacts);
router.get("/get/:id", validateToken, getEmergencyContactById);
router.patch("/update/:id", validateToken, updateEmergencyContactById);
router.delete("/deleteAll", validateToken, deleteAllEmergencyContacts);
router.delete("/delete/:id", validateToken, deleteEmergencyContactById);

module.exports = router;
