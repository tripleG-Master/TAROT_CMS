const express = require("express");
const controller = require("../controllers/tarotController");
const narrativeController = require("../controllers/narrativeController");

const router = express.Router();

router.get("/calculo", controller.showCalculo);
router.get("/lectura", controller.showLectura);
router.get("/conectores", narrativeController.showConnectors);
router.get("/mensajes", narrativeController.showMessages);

module.exports = router;
