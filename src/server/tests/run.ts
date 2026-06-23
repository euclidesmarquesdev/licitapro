import { runTests } from "../utils/testRunner.js";
import { logger } from "../utils/logger.js";

async function main() {
  console.log("\n🔬 Executando testes do sistema...\n");
  
  const results = await runTests();
  
  console.log("\n📊 Resumo dos testes:");
  console.log("─".repeat(50));
  
  let passCount = 0, warnCount = 0, failCount = 0;
  
  for (const result of results) {
    const icon = result.status === "PASS" ? "✅" :
                 result.status === "WARN" ? "⚠️" : "❌";
    console.log(`${icon} ${result.name} - ${result.status} (${result.duration}ms)`);
    if (result.message) {
      console.log(`   ${result.message}`);
    }
    
    if (result.status === "PASS") passCount++;
    else if (result.status === "WARN") warnCount++;
    else failCount++;
  }
  
  console.log("─".repeat(50));
  console.log(`\n📈 Total: ${results.length} | ✅ ${passCount} | ⚠️ ${warnCount} | ❌ ${failCount}`);
  
  if (failCount > 0) {
    console.log("\n❌ Alguns testes falharam. Verifique os logs.");
    process.exit(1);
  } else {
    console.log("\n✅ Todos os testes passaram! Sistema saudável.");
    process.exit(0);
  }
}

main().catch(console.error);