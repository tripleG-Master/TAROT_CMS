const express = require("express");
const controller = require("../controllers/majorArcanaController");

const router = express.Router();

router.get("/", controller.list);
router.get("/new", controller.showCreateForm);
router.post("/", controller.create);
router.get("/import", controller.showImportForm);
router.post("/import", controller.importJson);
router.post("/import/local", controller.importLocal);
router.get("/export/arcanos.json", controller.exportJson);
router.get("/:id", controller.show);
router.get("/:id/edit", controller.showEditForm);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
