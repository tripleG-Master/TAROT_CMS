const express = require("express");
const controller = require("../controllers/tarotController");
const narrativeController = require("../controllers/narrativeController");

const router = express.Router();

router.get("/calculo", controller.showCalculo);
router.get("/lectura", controller.showLectura);
router.get("/gemini", controller.showGemini);
router.get("/gemini/generations", controller.showGeminiGenerations);
router.get("/gemini/templates", controller.showGeminiTemplates);
router.get("/users", controller.showUsers);
router.get("/content", controller.showContent);
router.post("/content/app-config", controller.updateAppConfig);
router.get("/conectores", narrativeController.showConnectors);
router.get("/mensajes", narrativeController.showMessages);
router.post("/conectores/delete-all", narrativeController.deleteAllConnectors);
router.post("/mensajes/delete-all", narrativeController.deleteAllMessages);

module.exports = router;
