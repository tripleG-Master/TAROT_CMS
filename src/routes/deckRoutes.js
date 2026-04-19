const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  const url = String(req.originalUrl || "");
  const qIndex = url.indexOf("?");
  const qs = qIndex !== -1 ? url.slice(qIndex) : "";
  res.redirect(`/arcanos${qs}`);
});

module.exports = router;
