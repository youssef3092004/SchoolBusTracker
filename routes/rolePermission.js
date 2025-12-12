const { Router } = require("express");

const {
  createPermissionRole,
  getPermissionsByRoleId,
  getAllRolePermissions,
  updatePermissionsByRole,
  deletePermissionRole,
  deleteAllPermissionsByRole,
  deleteAllRolePermissions,
} = require("../controllers/rolePermission");
const verifyToken = require("../utils/verifyToken");
const checkPermission = require("../middleware/checkPermission");

const router = Router();

router.post(
  "/create",
  verifyToken,
  checkPermission("create_permission_role"),
  createPermissionRole
);
router.get(
  "/get/:id/:role",
  verifyToken,
  checkPermission("view_permission_role"),
  getPermissionsByRoleId
);
router.get(
  "/getAll",
  verifyToken,
  checkPermission("view_all_permission_roles"),
  getAllRolePermissions
);
router.patch(
  "/update/:id",
  verifyToken,
  checkPermission("update_permission_role"),
  updatePermissionsByRole
);
router.delete(
  "/deleteByPermission/:roleId/:permissionId",
  verifyToken,
  checkPermission("delete_permission_role"),
  deletePermissionRole
);
router.delete(
  "/deleteAllByRole/:role",
  verifyToken,
  checkPermission("delete_all_permission_roles"),
  deleteAllPermissionsByRole
);
router.delete(
  "/deleteAll",
  verifyToken,
  checkPermission("delete_all_role_permissions"),
  deleteAllRolePermissions
);

module.exports = router;
