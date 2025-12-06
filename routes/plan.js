const { Router } = require("express");
const {
  createPlan,
  getPlanById,
  getAllPlans,
  updatePlanById,
  deletePlanById,
  deleteAllPlans,
} = require("../controllers/plan");
const verifyToken = require("../utils/verifyToken");
const checkPermission = require("../middleware/checkPermission");

const router = Router();

router.post("/create", verifyToken, checkPermission("create_plan"), createPlan);
router.get("/get/:id", verifyToken, checkPermission("view_plan"), getPlanById);
router.get(
  "/getall",
  verifyToken,
  checkPermission("view_all_plans"),
  getAllPlans
);
router.patch(
  "/update/:id",
  verifyToken,
  checkPermission("update_plan"),
  updatePlanById
);
router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission("delete_plan"),
  deletePlanById
);
router.delete(
  "/deleteAll",
  verifyToken,
  checkPermission("delete_all_plans"),
  deleteAllPlans
);

module.exports = router;
