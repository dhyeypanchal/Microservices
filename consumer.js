const REGISTRY_PRIMARY_URL = process.env.REGISTRY_PRIMARY_URL || "http://localhost:4000";
const REGISTRY_BACKUP_URL = process.env.REGISTRY_BACKUP_URL || "http://localhost:4001";

async function discoverServices() {
  const registries = [
    { name: "Primary", url: REGISTRY_PRIMARY_URL },
    { name: "Backup", url: REGISTRY_BACKUP_URL }
  ];

  for (const registry of registries) {
    try {
      console.log(`Connecting to ${registry.name} registry (${registry.url})...`);
      const response = await fetch(`${registry.url}/services`);
      if (!response.ok) throw new Error(`Registry returned ${response.status}`);
      const services = await response.json();
      console.log(`✓ Connected to ${registry.name} registry successfully!`);
      return services;
    } catch (err) {
      console.warn(`✗ ${registry.name} registry unavailable: ${err.message}`);
    }
  }

  throw new Error("Both Primary and Backup registries are unreachable.");
}

async function main() {
  const services = await discoverServices();

  console.log("\nServices discovered from registry:");
  if (!services.length) {
    console.log("(none registered yet)");
    return;
  }

  for (const service of services) {
    const healthBadge = service.status === "UP" ? "✓ UP" : "✗ DOWN";
    console.log(`- ${service.name} [${service.id}] (${healthBadge}, last ping ${service.lastSeenSecondsAgo || 0}s ago)`);
    console.log(`  ${service.description}`);
    console.log(`  ${service.url}`);
  }

  // Step 2: Use the Calculator Service dynamically
  const calc = services.find((s) => s.id === "calculator");
  if (!calc || calc.status === "DOWN") {
    console.log("\n❌ [ALERT] Calculator service is NOT working! (No heartbeat received for over 10 seconds).");
  } else {
    console.log(`\nCalling Calculator Service (Status: ${calc.status}, last ping ${calc.lastSeenSecondsAgo}s ago)...`);
    try {
      const calcRes = await fetch(`${calc.url}/add?a=15&b=25`, {
        signal: AbortSignal.timeout(3000)
      });
      if (!calcRes.ok) throw new Error(`Service returned ${calcRes.status}`);
      const calcData = await calcRes.json();
      console.log(`Calculator response: 15 + 25 = ${calcData.result}`);
    } catch (err) {
      console.warn(`✗ Calculator service call failed: ${err.message}`);
    }
  }

  // Step 3: Use the Text Tools Service dynamically
  const text = services.find((s) => s.id === "text-tools");
  if (!text || text.status === "DOWN") {
    console.log("\n❌ [ALERT] Text Tools service is NOT working! (No heartbeat received for over 10 seconds).");
  } else {
    console.log(`\nCalling Text Service (Status: ${text.status}, last ping ${text.lastSeenSecondsAgo}s ago)...`);
    try {
      const sampleText = "Hello Microservices World";
      const textRes = await fetch(
        `${text.url}/analyze?text=${encodeURIComponent(sampleText)}`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (!textRes.ok) throw new Error(`Service returned ${textRes.status}`);
      const textData = await textRes.json();
      console.log("Text Tools response:", textData);
    } catch (err) {
      console.warn(`✗ Text service call failed: ${err.message}`);
    }
  }
}

main().catch((error) => {
  console.error("Could not discover services:", error.message);
  process.exitCode = 1;
});
