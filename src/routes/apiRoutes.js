const express = require("express");
const majorArcanaController = require("../controllers/majorArcanaController");
const geminiController = require("../controllers/geminiController");
const narrativeController = require("../controllers/narrativeController");
const registerController = require("../controllers/registerController");
const contentController = require("../controllers/contentController");
const zodiacRoutes = require("./zodiacRoutes");
const healthRoutes = require("./healthRoutes");

const router = express.Router();


router.use("/health", healthRoutes);
router.use("/zodiac", zodiacRoutes);

router.post("/register", registerController.register);
router.get("/users/:id/profile", registerController.getProfile);
router.post("/entitlements/set", registerController.setEntitlement);

router.get("/app-config", contentController.getAppConfig);
router.get("/content/manifest", contentController.getManifest);

router.post("/narrative/seed", narrativeController.seed);
router.post("/narrative/three-cards", narrativeController.threeCards);
router.post("/tarot/daily", narrativeController.dailyTarot);
router.post("/tarot/yes-no", narrativeController.yesNoTarot);

router.get("/gemini/models", geminiController.listModels);
router.post("/gemini/generate", geminiController.generate);
router.post("/gemini/tarot-reading", geminiController.tarotReading);
router.post("/gemini/generations/:id/promote", geminiController.promoteGeneration);
router.post("/gemini/templates/:id/approve", geminiController.approveTemplate);

router.get("/arcanos/export/arcanos.json", majorArcanaController.exportJson);
router.get("/arcanos/export/v2/arcanos.json", majorArcanaController.exportJsonV2);
router.get("/arcanos/export/custom/arcanos.json", majorArcanaController.exportJsonCustom);

module.exports = router;
