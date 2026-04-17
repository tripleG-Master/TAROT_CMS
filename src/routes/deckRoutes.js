const express = require("express");
const multer = require("multer");
const controller = require("../controllers/deckController");

const router = express.Router();
const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }
});

router.get("/", controller.index);
router.post("/deck-cards/import/csv/file", uploadCsv.single("deck_cards_csv_file"), controller.importDeckCardsCsvFile);

module.exports = router;

