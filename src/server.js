const { initDb } = require("./db");
const { createApp } = require("./app");
const dotenv = require("dotenv");

dotenv.config();

async function start() {
  await initDb();

  const app = createApp();
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  const host = process.env.HOST ? String(process.env.HOST) : undefined;

  const server = host
    ? app.listen(port, host, () => {
        const displayHost = host === "0.0.0.0" ? "localhost" : host;
        console.log(`Tarot CMS listo en http://${displayHost}:${port}`);
      })
    : app.listen(port, () => {
        console.log(`Tarot CMS listo en http://localhost:${port}`);
      });

  return server;
}

start().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

module.exports = { start };
