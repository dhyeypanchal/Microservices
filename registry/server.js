const express = require("express");

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 4000);
const services = new Map();

app.get("/health", (_req, res) => res.json({ status: "UP", role: "registry" }));

app.get("/services", (_req, res) => {
  res.json([...services.values()]);
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
    registeredAt: new Date().toISOString()
  };

  const existed = services.has(service.id);
  services.set(service.id, service);
  res.status(existed ? 200 : 201).json({ message: existed ? "Service updated" : "Service registered", service });
});

app.delete("/services/:id", (req, res) => {
  if (!services.has(req.params.id)) {
    return res.status(404).json({ error: "Service not found" });
  }
  services.delete(req.params.id);
  res.status(204).end();
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Registry listening on port ${PORT}`);
});
