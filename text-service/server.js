const express = require("express");

const app = express();
const PORT = Number(process.env.PORT || 3002);
const REGISTRY_PRIMARY_URL = process.env.REGISTRY_PRIMARY_URL || process.env.REGISTRY_URL || "http://localhost:4000";
const REGISTRY_BACKUP_URL = process.env.REGISTRY_BACKUP_URL || "http://localhost:4001";
const REGISTRY_URLS = [REGISTRY_PRIMARY_URL, REGISTRY_BACKUP_URL].filter(Boolean);

const SERVICE = {
  id: "text-tools",
  name: "Text Tools",
  description: "Counts characters and words in text",
  url: process.env.SERVICE_URL || `http://localhost:${PORT}`
};

app.get("/", (_req, res) => {
  res.json({ service: SERVICE.name, usage: "/analyze?text=hello%20world" });
});

app.get("/health", (_req, res) => res.json({ status: "UP", service: SERVICE.id }));

app.get("/analyze", (req, res) => {
  const text = req.query.text;
  if (typeof text !== "string") {
    return res.status(400).json({ error: "Provide a text query parameter" });
  }
  const trimmed = text.trim();
  res.json({
    text,
    characters: text.length,
    words: trimmed ? trimmed.split(/\s+/).length : 0
  });
});

async function register() {
  for (const url of REGISTRY_URLS) {
    try {
      const response = await fetch(`${url}/services`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(SERVICE)
      });
      if (!response.ok) throw new Error(`Registry returned ${response.status}`);
      console.log(`Registered ${SERVICE.id} with registry at ${url}`);
    } catch (error) {
      console.error(`Could not register ${SERVICE.id} with ${url}: ${error.message}`);
    }
  }
}

const server = app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Text service listening on port ${PORT}`);
  await register();
});

async function shutdown() {
  console.log("Shutting down text service...");
  for (const url of REGISTRY_URLS) {
    try {
      await fetch(`${url}/services/${SERVICE.id}`, { method: "DELETE" });
    } catch (error) {
      console.error(`Deregistration failed at ${url}: ${error.message}`);
    }
  }
  server.close(() => process.exit(0));
  // If the server does not close within 5 seconds, forcefully exit the process to avoid hanging indefinitely.
  // process.exit(1) means that the process will exit with a status code of 1, indicating an error or abnormal termination. The unref() method allows the process to exit even if the timeout is still pending, ensuring that the shutdown process does not hang indefinitely.
  setTimeout(() => process.exit(1), 5000).unref();
}
// sigterm and sigint are signals sent to the process when it is being terminated (e.g., by pressing Ctrl+C in the terminal or when the system is shutting down). The shutdown function is called to gracefully deregister the service from the registry and close the server before exiting the process.
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
