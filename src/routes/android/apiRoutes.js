const express = require("express");
const majorArcanaController = require("../../controllers/majorArcanaController");
const minorArcanaController = require("../../controllers/minorArcanaController");
const geminiController = require("../../controllers/geminiController");
const narrativeController = require("../../controllers/narrativeController");
const tarotApiController = require("../../controllers/tarotApiController");
const registerController = require("../../controllers/registerController");
const contentController = require("../../controllers/contentController");
const zodiacRoutes = require("../zodiacRoutes");

const router = express.Router();

router.post("/register", registerController.register);
router.get("/users/:id/profile", registerController.getProfile);
router.post("/entitlements/set", registerController.setEntitlement);
router.get("/app-config", contentController.getAppConfig);
router.get("/content/manifest", contentController.getManifest);
router.get("/cards", contentController.getAndroidCards);

router.get("/arcanos/export/arcanos.json", majorArcanaController.exportJson);
router.get("/arcanos/export/v2/arcanos.json", majorArcanaController.exportJsonV2);
router.get("/menores/export/v2/arcanos-menores.json", minorArcanaController.exportJsonV2);

router.use("/zodiac", zodiacRoutes);
router.post("/narrative/seed", narrativeController.seed);
router.post("/narrative/three-cards", narrativeController.threeCards);
router.post("/tarot/daily", tarotApiController.dailyTarot);
router.post("/tarot/yes-no", tarotApiController.yesNoTarot);
router.post("/gemini/tarot-reading", geminiController.tarotReading);
router.post("/gemini/tarot-reading-lite", geminiController.tarotReadingLite);

module.exports = router;
