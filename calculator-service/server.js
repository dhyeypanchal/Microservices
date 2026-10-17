const express = require("express");

const app = express();
const PORT = Number(process.env.PORT || 3001);
const REGISTRY_PRIMARY_URL = process.env.REGISTRY_PRIMARY_URL || process.env.REGISTRY_URL || "http://localhost:4000";
const REGISTRY_BACKUP_URL = process.env.REGISTRY_BACKUP_URL || "http://localhost:4001";
const REGISTRY_URLS = [REGISTRY_PRIMARY_URL, REGISTRY_BACKUP_URL].filter(Boolean);

const SERVICE = {
  id: "calculator",
  name: "Calculator",
  description: "Adds two numbers",
  url: process.env.SERVICE_URL || `http://localhost:${PORT}`
};

app.get("/", (_req, res) => {
  res.json({ service: SERVICE.name, usage: "/add?a=2&b=3" });
});

app.get("/health", (_req, res) => res.json({ status: "UP", service: SERVICE.id }));

app.get("/add", (req, res) => {
  const a = Number(req.query.a);
  const b = Number(req.query.b);
  if (req.query.a === undefined || req.query.b === undefined || !Number.isFinite(a) || !Number.isFinite(b)) {
    return res.status(400).json({ error: "Provide numeric query parameters a and b" });
  }
  res.json({ a, b, result: a + b });
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

let heartbeatInterval = null;

function startHeartbeat() {
  const HEARTBEAT_INTERVAL_MS = Number(process.env.HEARTBEAT_INTERVAL_MS || 5000);
  heartbeatInterval = setInterval(async () => {
    for (const url of REGISTRY_URLS) {
      try {
        const response = await fetch(`${url}/services/${SERVICE.id}/heartbeat`, {
          method: "POST"
        });
        if (response.ok) {
          console.log(`[Heartbeat] Heartbeat acknowledged by registry at ${url}`);
        } else if (response.status === 404) {
          console.warn(`[Heartbeat] ${SERVICE.id} not found on registry at ${url}. Re-registering...`);
          await register();
        }
      } catch (error) {
        // Registry might be temporarily unreachable, ignore error
      }
    }
  }, HEARTBEAT_INTERVAL_MS);
}

const server = app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Calculator service listening on port ${PORT}`);
  await register();
  startHeartbeat();
});

async function shutdown() {
  console.log("Shutting down calculator service...");
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  for (const url of REGISTRY_URLS) {
    try {
      await fetch(`${url}/services/${SERVICE.id}`, { method: "DELETE" });
    } catch (error) {
      console.error(`Deregistration failed at ${url}: ${error.message}`);
    }
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
