const express = require("express");
const majorArcanaController = require("../controllers/majorArcanaController");
const narrativeController = require("../controllers/narrativeController");
const registerController = require("../controllers/registerController");
const zodiacRoutes = require("./zodiacRoutes");
const healthRoutes = require("./healthRoutes");

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/zodiac", zodiacRoutes);
router.post("/register", registerController.register);


router.post("/narrative/seed", narrativeController.seed);
router.post("/narrative/three-cards", narrativeController.threeCards);

router.get("/arcanos/export/arcanos.json", majorArcanaController.exportJson);
router.get("/arcanos/export/v2/arcanos.json", majorArcanaController.exportJsonV2);
router.get("/arcanos/export/custom/arcanos.json", majorArcanaController.exportJsonCustom);

module.exports = router;
