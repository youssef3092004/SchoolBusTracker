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

const router = Router();

router.post("/create", verifyToken, createPlan);
router.get("/get/:id", verifyToken, getPlanById);
router.get("/getall", verifyToken, getAllPlans);
router.patch("/update/:id", verifyToken, updatePlanById);
router.delete("/delete/:id", verifyToken, deletePlanById);
router.delete("/deleteAll", verifyToken, deleteAllPlans);

module.exports = router;
