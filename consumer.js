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
    console.log(`- ${service.name} [${service.id}]`);
    console.log(`  ${service.description}`);
    console.log(`  ${service.url}`);
  }

  // Step 2: Use the Calculator Service dynamically
  const calc = services.find((s) => s.id === "calculator");
  if (calc) {
    console.log("\nCalling Calculator Service...");
    const calcRes = await fetch(`${calc.url}/add?a=15&b=25`);
    const calcData = await calcRes.json();
    console.log(`Calculator response: 15 + 25 = ${calcData.result}`);
  }
  // Step 3: Use the Text Tools Service dynamically
  const text = services.find((s) => s.id === "text-tools");
  if (text) {
    console.log("\nCalling Text Service...");
    const sampleText = "Hello Microservices World";
    const textRes = await fetch(
      `${text.url}/analyze?text=${encodeURIComponent(sampleText)}`,
    );
    const textData = await textRes.json();
    console.log("Text Tools response:", textData);
  }
}

main().catch((error) => {
  console.error("Could not discover services:", error.message);
  process.exitCode = 1;
});
