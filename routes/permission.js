const { Router } = require("express");
const {
  createPermission,
  getPermissionById,
  getAllPermissions,
  updatePermissionById,
  deletePermissionById,
  deleteAllPermissions,
} = require("../controllers/permission");
const verifyToken = require("../utils/verifyToken");
const checkPermission = require("../middleware/checkPermission");

const router = Router();

router.post(
  "/create",
  verifyToken,
  checkPermission("create_permission"),
  createPermission
);
router.get(
  "/get/:id",
  verifyToken,
  checkPermission("view_permission"),
  getPermissionById
);
router.get(
  "/getAll",
  verifyToken,
  checkPermission("view_all_permissions"),
  getAllPermissions
);
router.patch(
  "/update/:id",
  verifyToken,
  checkPermission("update_permission"),
  updatePermissionById
);
router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission("delete_permission"),
  deletePermissionById
);
router.delete(
  "/deleteAll",
  verifyToken,
  checkPermission("delete_all_permissions"),
  deleteAllPermissions
);

module.exports = router;
