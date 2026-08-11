const express = require("express");
const router = express.Router();

const aiController = require("../aiService");

// OLD endpoints
router.post("/description", aiController.generateDescription);
router.post("/recommendations", aiController.generateRecommendations);
router.post("/search", aiController.generateSearch);

// NEW meal plan endpoint
router.post("/meal-plan", aiController.generateMealPlan);

// extra test endpoint
router.get("/test", aiController.testAI);

// clear cache
router.delete("/clear-cache", aiController.clearCache);

module.exports = router;
