const express = require("express");
const controller = require("../controllers/healthController");

const router = express.Router();

router.get("/", controller.health);

module.exports = router;
