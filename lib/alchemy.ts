const ALCHEMY_BASE_URL = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

// ERC-20 Transfer event topic
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// Base produces ~2 blocks/second → blocks per period:
const BLOCKS_PER_HOUR = 7_200;
const BLOCKS_PER_DAY  = 172_800;

async function rpc(method: string, params: unknown[]) {
  const res = await fetch(ALCHEMY_BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`Alchemy RPC error: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`RPC error: ${data.error.message}`);
  return data.result;
}

// ─── Get all holders by scanning Transfer events ──────────────────────────────
// lookback: "1h" | "1d" | "7d" (default: "1d")
export async function getAllHolders(
  contractAddress: string,
  lookback: "1h" | "1d" | "7d" = "1d"
): Promise<{ address: string; rawBalance: string }[]> {

  const lookbackBlocks =
    lookback === "1h" ? BLOCKS_PER_HOUR :
    lookback === "1d" ? BLOCKS_PER_DAY  :
    BLOCKS_PER_DAY * 7;

  console.log(`📡 Scanning Transfer logs (last ${lookback})...`);

  const latestHex: string = await rpc("eth_blockNumber", []);
  const latest = parseInt(latestHex, 16);
  const fromBlock = Math.max(0, latest - lookbackBlocks);

  const CHUNK = 10_000;
  const addressSet = new Set<string>();

  for (let start = fromBlock; start < latest; start += CHUNK) {
    const end = Math.min(start + CHUNK - 1, latest);
    const logs = await rpc("eth_getLogs", [{
      address: contractAddress,
      topics: [TRANSFER_TOPIC],
      fromBlock: `0x${start.toString(16)}`,
      toBlock:   `0x${end.toString(16)}`,
    }]);

    for (const log of logs) {
      if (log.topics?.[2]) {
        const addr = "0x" + log.topics[2].slice(26).toLowerCase();
        if (addr !== "0x0000000000000000000000000000000000000000") {
          addressSet.add(addr);
        }
      }
    }
  }

  console.log(`📋 ${addressSet.size} unique addresses found, checking balances...`);

  // Check current balance of each address in parallel batches
  const addresses = Array.from(addressSet);
  const holders: { address: string; rawBalance: string }[] = [];
  const BATCH = 50;

  for (let i = 0; i < addresses.length; i += BATCH) {
    const batch = addresses.slice(i, i + BATCH);
    const balances = await Promise.all(
      batch.map((addr) => getWalletTokenBalance(addr, contractAddress))
    );
    for (let j = 0; j < batch.length; j++) {
      if (BigInt(balances[j]) > BigInt(0)) {
        holders.push({ address: batch[j], rawBalance: balances[j] });
      }
    }
  }

  console.log(`✅ ${holders.length} active holders`);
  return holders;
}

// ─── Get single wallet token balance via eth_call → balanceOf() ───────────────
export async function getWalletTokenBalance(
  wallet: string,
  contractAddress: string
): Promise<string> {
  const data =
    "0x70a08231" + wallet.toLowerCase().replace("0x", "").padStart(64, "0");
  const result = await rpc("eth_call", [{ to: contractAddress, data }, "latest"]);
  return result ?? "0x0";
}

// ─── Get ETH balance of a wallet (for vault/fees tracking) ───────────────────
export async function getEthBalance(wallet: string): Promise<string> {
  const result = await rpc("eth_getBalance", [wallet, "latest"]);
  return result ?? "0x0";
}

// ─── Get ERC-20 token balance + ETH balance of the vault/fees wallet ─────────
export async function getVaultWalletInfo(
  vaultWallet: string,
  tokenContract: string
): Promise<{
  eth_balance_wei: string;
  eth_balance: number;
  token_balance_raw: string;
  token_balance: number;
}> {
  const [ethRaw, tokenRaw] = await Promise.all([
    getEthBalance(vaultWallet),
    getWalletTokenBalance(vaultWallet, tokenContract),
  ]);

  const ethWei   = BigInt(ethRaw);
  const tokenWei = BigInt(tokenRaw);

  return {
    eth_balance_wei:  ethRaw,
    eth_balance:      Number(ethWei)   / 1e18,
    token_balance_raw: tokenRaw,
    token_balance:    Number(tokenWei) / 1e18,
  };
}
