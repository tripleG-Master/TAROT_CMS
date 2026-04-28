const express = require("express");
const controller = require("../controllers/tarotController");
const narrativeController = require("../controllers/narrativeController");

const router = express.Router();

router.get("/calculo", controller.showCalculo);
router.get("/lectura", controller.showLectura);
router.get("/tipos", controller.showTarotTypes);
router.get("/gemini", controller.showGemini);
router.get("/gemini/generations", controller.showGeminiGenerations);
router.get("/gemini/templates", controller.showGeminiTemplates);
router.get("/historial", controller.showHistoricalTarot);
router.get("/users", controller.showUsers);
router.get("/users/:id/edit", controller.showUserEdit);
router.put("/users/:id", controller.updateUser);
router.delete("/users/:id", controller.deleteUser);
router.get("/content", controller.showContent);
router.post("/content/app-config", controller.updateAppConfig);
router.get("/conectores", narrativeController.showConnectors);
router.get("/mensajes", narrativeController.showMessages);
router.post("/conectores/delete-all", narrativeController.deleteAllConnectors);
router.post("/mensajes/delete-all", narrativeController.deleteAllMessages);

module.exports = router;
