const { Router } = require("express");
const {
  createNotification,
  getNotificationById,
  getAllNotifications,
  updateNotificationById,
  deleteNotificationById,
  deleteAllNotifications,
} = require("../controllers/notification");

const router = Router();

router.post("/create", createNotification);
router.get("/get/:id", getNotificationById);
router.get("/getAll", getAllNotifications);
router.patch("/update/:id", updateNotificationById);
router.delete("/delete/:id", deleteNotificationById);
router.delete("/deleteAll", deleteAllNotifications);

module.exports = router;
