const { Router } = require("express");
const {
  createNotification,
  getNotificationById,
  getAllNotifications,
  updateNotificationById,
  deleteNotificationById,
  deleteAllNotifications,
} = require("../controllers/notification");
const validateToken = require("../utils/verifyToken");

const router = Router();

router.post("/create", validateToken, createNotification);
router.get("/get/:id", validateToken, getNotificationById);
router.get("/getAll", validateToken, getAllNotifications);
router.patch("/update/:id", validateToken, updateNotificationById);
router.delete("/delete/:id", validateToken, deleteNotificationById);
router.delete("/deleteAll", validateToken, deleteAllNotifications);

module.exports = router;
