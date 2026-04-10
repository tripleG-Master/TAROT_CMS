const express = require("express");
const controller = require("../controllers/tarotController");
const narrativeController = require("../controllers/narrativeController");

const router = express.Router();

router.get("/calculo", controller.showCalculo);
router.get("/lectura", controller.showLectura);
router.get("/gemini", controller.showGemini);
router.get("/gemini/generations", controller.showGeminiGenerations);
router.get("/gemini/templates", controller.showGeminiTemplates);
router.get("/conectores", narrativeController.showConnectors);
router.get("/mensajes", narrativeController.showMessages);

module.exports = router;
