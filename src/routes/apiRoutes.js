const express = require("express");
const majorArcanaController = require("../controllers/majorArcanaController");
const geminiController = require("../controllers/geminiController");
const narrativeController = require("../controllers/narrativeController");
const tarotApiController = require("../controllers/tarotApiController");
const registerController = require("../controllers/registerController");
const contentController = require("../controllers/contentController");
const zodiacRoutes = require("./zodiacRoutes");
const healthRoutes = require("./healthRoutes");

const router = express.Router();

const android = express.Router();

android.post("/register", registerController.register);
android.get("/users/:id/profile", registerController.getProfile);
android.post("/entitlements/set", registerController.setEntitlement);
android.get("/app-config", contentController.getAppConfig);
android.get("/content/manifest", contentController.getManifest);
android.get("/cards", contentController.getAndroidCards);
android.use("/zodiac", zodiacRoutes);
android.post("/narrative/seed", narrativeController.seed);
android.post("/narrative/three-cards", narrativeController.threeCards);
android.post("/tarot/daily", tarotApiController.dailyTarot);
android.post("/tarot/yes-no", tarotApiController.yesNoTarot);
android.post("/gemini/tarot-reading", geminiController.tarotReading);
android.post("/gemini/tarot-reading-lite", geminiController.tarotReadingLite);


router.use("/health", healthRoutes);
router.use("/zodiac", zodiacRoutes);
router.use("/android", android);

router.post("/register", registerController.register);
router.get("/users/:id/profile", registerController.getProfile);
router.post("/entitlements/set", registerController.setEntitlement);

router.get("/app-config", contentController.getAppConfig);
router.get("/content/manifest", contentController.getManifest);

router.post("/narrative/seed", narrativeController.seed);
router.post("/narrative/three-cards", narrativeController.threeCards);
router.post("/tarot/daily", tarotApiController.dailyTarot);
router.post("/tarot/yes-no", tarotApiController.yesNoTarot);

router.get("/gemini/models", geminiController.listModels);
router.post("/gemini/generate", geminiController.generate);
router.post("/gemini/tarot-reading", geminiController.tarotReading);
router.post("/gemini/tarot-reading-lite", geminiController.tarotReadingLite);
router.post("/gemini/generations/:id/promote", geminiController.promoteGeneration);
router.post("/gemini/templates/:id/approve", geminiController.approveTemplate);

router.get("/arcanos/export/arcanos.json", majorArcanaController.exportJson);
router.get("/arcanos/export/v2/arcanos.json", majorArcanaController.exportJsonV2);
router.get("/arcanos/export/custom/arcanos.json", majorArcanaController.exportJsonCustom);

module.exports = router;
