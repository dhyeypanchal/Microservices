const express = require("express");

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 4000);
const services = new Map();

app.get("/health", (_req, res) => res.json({ status: "UP", role: "registry" }));

app.get("/services", (_req, res) => {
  const now = Date.now();
  const list = [...services.values()].map((s) => {
    const elapsedSeconds = Math.round((now - s.lastHeartbeat) / 1000);
    const isHealthy = (now - s.lastHeartbeat) <= HEARTBEAT_TIMEOUT_MS;
    return {
      ...s,
      status: isHealthy ? "UP" : "DOWN",
      lastSeenSecondsAgo: elapsedSeconds
    };
  });
  res.json(list);
});

app.get("/services/:id", (req, res) => {
  const service = services.get(req.params.id);
  if (!service) return res.status(404).json({ error: "Service not found" });
  res.json(service);
});

app.post("/services", (req, res) => {
  const { id, name, description, url } = req.body || {};
  if (![id, name, description, url].every((v) => typeof v === "string" && v.trim())) {
    return res.status(400).json({
      error: "id, name, description and url must be non-empty strings"
    });
  }

  const service = {
    id: id.trim(),
    name: name.trim(),
    description: description.trim(),
    url: url.trim(),
    registeredAt: new Date().toISOString(),
    lastHeartbeat: Date.now()
  };

  const existed = services.has(service.id);
  services.set(service.id, service);
  res.status(existed ? 200 : 201).json({ message: existed ? "Service updated" : "Service registered", service });
});

app.post("/services/:id/heartbeat", (req, res) => {
  const service = services.get(req.params.id);
  if (!service) {
    return res.status(404).json({ error: "Service not found" });
  }
  service.lastHeartbeat = Date.now();
  console.log(`[Heartbeat] Received ping from "${service.id}" (status: HEALTHY)`);
  res.json({ message: "Heartbeat acknowledged", id: service.id, status: "UP" });
});

app.delete("/services/:id", (req, res) => {
  if (!services.has(req.params.id)) {
    return res.status(404).json({ error: "Service not found" });
  }
  services.delete(req.params.id);
  res.status(204).end();
});

const HEARTBEAT_TIMEOUT_MS = Number(process.env.HEARTBEAT_TIMEOUT_MS || 10000);
const SWEEPER_INTERVAL_MS = Number(process.env.SWEEPER_INTERVAL_MS || 2000);

setInterval(() => {
  const now = Date.now();
  for (const [id, service] of services.entries()) {
    const elapsed = now - service.lastHeartbeat;
    if (elapsed > HEARTBEAT_TIMEOUT_MS) {
      console.warn(`[ALERT] Service "${id}" stopped sending heartbeats (>10s)! Evicted from active registry.`);
      services.delete(id);
    }
  }
}, SWEEPER_INTERVAL_MS);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Registry listening on port ${PORT}`);
});
