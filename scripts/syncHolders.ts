// Sync on-chain $PKMN SPL token holders to Supabase
// Run: npm run sync-holders

const BASE_URL    = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET ?? "dev-secret-123";

async function main() {
  console.log(`🔄 Syncing Solana holders...`);

  const res = await fetch(`${BASE_URL}/api/holders/sync`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${CRON_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("❌ Sync failed:", data);
    process.exit(1);
  }

  console.log(`✅ Synced: ${data.synced} holders, zeroed: ${data.zeroed}`);
  console.log(`   Vault SOL: ${data.vault_sol} | Vault USD: $${data.vault_usd}`);
  console.log(`   Timestamp: ${data.timestamp}`);
}

main().catch(console.error);
