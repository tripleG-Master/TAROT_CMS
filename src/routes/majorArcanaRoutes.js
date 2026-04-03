const express = require("express");
const multer = require("multer");
const controller = require("../controllers/majorArcanaController");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }
});

router.get("/", controller.list);
router.get("/new", controller.showCreateForm);
router.post("/", controller.create);
router.get("/import", controller.showImportForm);
router.post("/import", controller.importJson);
router.post("/import/csv", controller.importCsv);
router.post("/import/csv/file", upload.single("csv_file"), controller.importCsvFile);
router.post("/import/local", controller.importLocal);
router.get("/export/arcanos.json", controller.exportJson);
router.get("/export/v2/arcanos.json", controller.exportJsonV2);
router.get("/export/builder", controller.showExportBuilder);
router.post("/export/builder", controller.previewExportBuilder);
router.get("/export/custom/arcanos.json", controller.exportJsonCustom);
router.get("/:id", controller.show);
router.get("/:id/edit", controller.showEditForm);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
