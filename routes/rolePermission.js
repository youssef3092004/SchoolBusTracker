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

const router = Router();

router.post("/create", verifyToken, createPermissionRole);
router.get("/get/:role/:id", verifyToken, getPermissionsByRoleId);
router.get("/getAll", verifyToken, getAllRolePermissions);
router.patch("/update/:id", verifyToken, updatePermissionsByRole);
router.delete("/delete/:role/:id", verifyToken, deletePermissionRole);
router.delete(
  "/deleteAllByRole/:role",
  verifyToken,
  deleteAllPermissionsByRole
);
router.delete("/deleteAll", verifyToken, deleteAllRolePermissions);

module.exports = router;
