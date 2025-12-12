const { Router } = require("express");
const {
  registerParent,
  loginParent,
  logoutParent,
  updateParent,
  getParentById,
  getAllParents,
  deleteParentById,
  deleteAllParents,
} = require("../controllers/parent");
const verifyToken = require("../utils/verifyToken");
const checkPermission = require("../middleware/checkPermission");

const router = Router();

router.post(
  "/register",
  verifyToken,
  checkPermission("create_parent"),
  registerParent
);
router.post("/login", loginParent);
router.post("/logout", verifyToken, logoutParent);
router.patch(
  "/update",
  verifyToken,
  checkPermission("update_parent"),
  updateParent
);
router.get(
  "/get/:id",
  verifyToken,
  checkPermission("view_parent"),
  getParentById
);
router.get(
  "/getAll",
  verifyToken,
  checkPermission("view_all_parents"),
  getAllParents
);
router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission("delete_parent"),
  deleteParentById
);
router.delete(
  "/deleteAll",
  verifyToken,
  checkPermission("delete_all_parents"),
  deleteAllParents
);

module.exports = router;
