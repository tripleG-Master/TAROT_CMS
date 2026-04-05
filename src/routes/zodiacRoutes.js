const express = require("express");
const controller = require("../controllers/zodiacController");

const router = express.Router();

router.get("/", controller.respondZodiac);
router.post("/", controller.respondZodiac);

module.exports = router;
