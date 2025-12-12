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
const checkPermission = require("../middleware/checkPermission");

const router = Router();

router.post(
  "/create",
  validateToken,
  checkPermission("create_notification"),
  createNotification
);
router.get(
  "/get/:id",
  validateToken,
  checkPermission("view_notification"),
  getNotificationById
);
router.get(
  "/getAll",
  validateToken,
  checkPermission("view_all_notifications"),
  getAllNotifications
);
router.patch(
  "/update/:id",
  validateToken,
  checkPermission("update_notification"),
  updateNotificationById
);
router.delete(
  "/delete/:id",
  validateToken,
  checkPermission("delete_notification"),
  deleteNotificationById
);
router.delete(
  "/deleteAll",
  validateToken,
  checkPermission("delete_all_notifications"),
  deleteAllNotifications
);

module.exports = router;
