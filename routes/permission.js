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

const router = Router();

router.post("/create", verifyToken, createPermission);
router.get("/get/:id", verifyToken, getPermissionById);
router.get("/getAll", verifyToken, getAllPermissions);
router.patch("/update/:id", verifyToken, updatePermissionById);
router.delete("/delete/:id", verifyToken, deletePermissionById);
router.delete("/deleteAll", verifyToken, deleteAllPermissions);

module.exports = router;
