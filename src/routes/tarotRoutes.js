const express = require("express");
const controller = require("../controllers/tarotController");

const router = express.Router();

router.get("/calculo", controller.showCalculo);

module.exports = router;
