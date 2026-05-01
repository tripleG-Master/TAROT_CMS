const express = require("express");
const controller = require("../controllers/zodiacController");

const router = express.Router();

router.get("/", controller.respondZodiac);
router.post("/", controller.respondZodiac);
router.get("/:subPath", controller.respondZodiac);
router.post("/:subPath", controller.respondZodiac);

module.exports = router;
