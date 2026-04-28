const express = require("express");
const majorArcanaController = require("../../controllers/majorArcanaController");
const geminiController = require("../../controllers/geminiController");
const zodiacRoutes = require("../zodiacRoutes");
const healthRoutes = require("../healthRoutes");

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/zodiac", zodiacRoutes);

router.get("/gemini/models", geminiController.listModels);
router.post("/gemini/generate", geminiController.generate);
router.post("/gemini/generations/:id/promote", geminiController.promoteGeneration);
router.post("/gemini/templates/:id/approve", geminiController.approveTemplate);

router.get("/arcanos/export/arcanos.json", majorArcanaController.exportJson);
router.get("/arcanos/export/v2/arcanos.json", majorArcanaController.exportJsonV2);
router.get("/arcanos/export/custom/arcanos.json", majorArcanaController.exportJsonCustom);

module.exports = router;
