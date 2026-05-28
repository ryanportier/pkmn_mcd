// Next.js carga .env.local automáticamente en dev
// Sync on-chain PKMN holders to Supabase
// Run: npm run sync-holders
// Or:  npm run sync-holders -- --lookback 1h
// Or:  npm run sync-holders -- --lookback 7d

const BASE_URL    = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET ?? "dev-secret-123";

// Parse --lookback flag from CLI args
const args      = process.argv.slice(2);
const lbIdx     = args.indexOf("--lookback");
const lookback  = (lbIdx !== -1 ? args[lbIdx + 1] : "1d") as "1h" | "1d" | "7d";

const VALID = ["1h", "1d", "7d"];
if (!VALID.includes(lookback)) {
  console.error(`❌ Invalid --lookback value "${lookback}". Use: 1h | 1d | 7d`);
  process.exit(1);
}

async function main() {
  console.log(`🔄 Syncing holders (lookback: ${lookback})...`);

  const res = await fetch(`${BASE_URL}/api/holders/sync`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${CRON_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ lookback }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("❌ Sync failed:", data);
    process.exit(1);
  }

  console.log(`✅ Synced: ${data.synced} holders, zeroed: ${data.zeroed}`);
  console.log(`   Lookback: ${data.lookback} | Timestamp: ${data.timestamp}`);
}

main().catch(console.error);
