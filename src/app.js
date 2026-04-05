const path = require("node:path");
const express = require("express");
const { engine } = require("express-handlebars");
const methodOverride = require("method-override");
const morgan = require("morgan");


const majorArcanaRoutes = require("./routes/majorArcanaRoutes");
const zodiacRoutes = require("./routes/zodiacRoutes");
const tarotRoutes = require("./routes/tarotRoutes");
const apiRoutes = require("./routes/apiRoutes");
const { requireApiToken } = require("./middleware/apiAuth");
const healthRoutes = require("./routes/healthRoutes");

function createApp() {
  const app = express();

  const viewsDir = path.join(__dirname, "views");
  app.engine(
    "hbs",
    engine({
      extname: "hbs",
      defaultLayout: "main",
      layoutsDir: path.join(viewsDir, "layouts"),
      partialsDir: path.join(viewsDir, "partials"),
      helpers: {
        eq: (a, b) => a === b
      }
    })
  );
  app.set("view engine", "hbs");
  app.set("views", viewsDir);

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(methodOverride("_method"));
  app.use("/public", express.static(path.join(__dirname, "..", "public")));

  app.use(morgan("dev"));

  app.use("/health", healthRoutes);

  app.get("/", (req, res) => res.redirect("/arcanos"));
  app.use("/arcanos", majorArcanaRoutes);
  app.use("/zodiac", zodiacRoutes);
  app.use("/tarot", tarotRoutes);
  app.use("/api", requireApiToken, apiRoutes);


  app.use((req, res) => {
    res.status(404).render("notFound", { title: "No encontrado" });
  });

  app.use((err, req, res, next) => {
    const status = Number.isInteger(err?.status) ? err.status : 500;
    res.status(status).render("error", {
      title: "Error",
      message: err?.message || "Error inesperado",
      status
    });
  });

  return app;
}

module.exports = { createApp };
