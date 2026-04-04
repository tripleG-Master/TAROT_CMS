const express = require("express");
const multer = require("multer");
const controller = require("../controllers/majorArcanaController");

const router = express.Router();
const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }
});
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = typeof file?.mimetype === "string" && file.mimetype.startsWith("image/");
    cb(ok ? null : new Error("Archivo inválido (se esperaba imagen)."), ok);
  }
});

router.get("/", controller.list);
router.get("/new", controller.showCreateForm);
router.post("/", uploadImage.single("imagen_file"), controller.create);
router.get("/import", controller.showImportForm);
router.post("/import", controller.importJson);
router.post("/import/csv", controller.importCsv);
router.post("/import/csv/file", uploadCsv.single("csv_file"), controller.importCsvFile);
router.post("/import/local", controller.importLocal);
router.get("/export/arcanos.json", controller.exportJson);
router.get("/export/v2/arcanos.json", controller.exportJsonV2);
router.get("/export/builder", controller.showExportBuilder);
router.post("/export/builder", controller.previewExportBuilder);
router.get("/export/custom/arcanos.json", controller.exportJsonCustom);
router.get("/:id", controller.show);
router.get("/:id/edit", controller.showEditForm);
router.put("/:id", uploadImage.single("imagen_file"), controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
