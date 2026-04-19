const express = require("express");
const geminiController = require("../controllers/geminiController");
const narrativeController = require("../controllers/narrativeController");
const registerController = require("../controllers/registerController");
const contentController = require("../controllers/contentController");
const zodiacRoutes = require("./zodiacRoutes");

const router = express.Router();

// Identidad y perfil Android
router.post("/register", registerController.register);
router.get("/users/:id/profile", registerController.getProfile);
router.post("/entitlements/set", registerController.setEntitlement);

// Config remota para app
router.get("/app-config", contentController.getAppConfig);
router.get("/content/manifest", contentController.getManifest);
router.use("/zodiac", zodiacRoutes);

// Tiradas Android
router.post("/narrative/seed", narrativeController.seed);
router.post("/narrative/three-cards", narrativeController.threeCards);
router.post("/tarot/daily", narrativeController.dailyTarot);
router.post("/tarot/yes-no", narrativeController.yesNoTarot);

// Premium Gemini app
router.post("/gemini/tarot-reading", geminiController.tarotReading);

module.exports = router;
