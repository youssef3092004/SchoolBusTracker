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

const router = Router();

router.post("/register", verifyToken, registerParent);
router.post("/login", loginParent);
router.post("/logout", verifyToken, logoutParent);
router.patch("/update", verifyToken, updateParent);
router.get("/get/:id", verifyToken, getParentById);
router.get("/getAll", verifyToken, getAllParents);
router.delete("/delete/:id", verifyToken, deleteParentById);
router.delete("/deleteAll", verifyToken, deleteAllParents);

module.exports = router;
