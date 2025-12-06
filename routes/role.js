const { Router } = require("express");

const {
  createRole,
  getRoleById,
  getAllRoles,
  deleteById,
  deleteAll,
} = require("../controllers/role");
const verifyToken = require("../utils/verifyToken");
const checkPermission = require("../middleware/checkPermission");

const router = Router();

router.post("/create", verifyToken, checkPermission("create_role"), createRole);
router.get(
  "/getAll",
  verifyToken,
  checkPermission("view_all_roles"),
  getAllRoles
);
router.get("/get/:id", verifyToken, checkPermission("view_role"), getRoleById);
router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission("delete_role"),
  deleteById
);
router.delete(
  "/deleteAll",
  verifyToken,
  checkPermission("delete_all_roles"),
  deleteAll
);

module.exports = router;
