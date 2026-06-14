// ─── Helius Solana RPC ────────────────────────────────────────────────────────
// Uses Helius DAS API for token accounts (free tier: 1M req/month)

const HELIUS_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.ALCHEMY_API_KEY}`;
const DECIMALS   = 9;

async function rpc(method: string, params: unknown) {
  const res = await fetch(HELIUS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`Helius RPC error: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`RPC error: ${data.error.message}`);
  return data.result;
}

// ─── Get all SPL token holders via Helius getTokenAccounts ───────────────────
export async function getAllHolders(
  mintAddress: string
): Promise<{ address: string; rawBalance: string }[]> {
  console.log(`📡 Fetching SPL token holders for mint: ${mintAddress}`);

  const holders: { address: string; rawBalance: string }[] = [];
  let cursor: string | undefined = undefined;

  do {
    const params: Record<string, unknown> = {
      mint: mintAddress,
      limit: 1000,
      displayOptions: { showZeroBalance: false },
    };
    if (cursor) params.cursor = cursor;

    const result = await rpc("getTokenAccounts", params);
    const accounts: any[] = result?.token_accounts ?? [];

    for (const acc of accounts) {
      const owner  = acc.owner as string;
      const amount = acc.amount ?? "0";
      if (BigInt(amount) > BigInt(0)) {
        holders.push({ address: owner, rawBalance: amount.toString() });
      }
    }

    cursor = result?.cursor ?? undefined;
  } while (cursor);

  // Deduplicate by owner (sum multiple ATAs)
  const dedupMap = new Map<string, bigint>();
  for (const h of holders) {
    const prev = dedupMap.get(h.address) ?? BigInt(0);
    dedupMap.set(h.address, prev + BigInt(h.rawBalance));
  }

  const result = Array.from(dedupMap.entries()).map(([address, bal]) => ({
    address,
    rawBalance: bal.toString(),
  }));

  console.log(`✅ ${result.length} active holders`);
  return result;
}

// ─── Get SPL token balance for a single wallet ────────────────────────────────
export async function getWalletTokenBalance(
  walletAddress: string,
  mintAddress: string
): Promise<string> {
  try {
    const result = await rpc("getTokenAccountsByOwner", [
      walletAddress,
      { mint: mintAddress },
      { encoding: "jsonParsed" },
    ]);

    const accounts: any[] = result?.value ?? [];
    if (accounts.length === 0) return "0";

    let total = BigInt(0);
    for (const acc of accounts) {
      const amount =
        acc.account?.data?.parsed?.info?.tokenAmount?.amount ?? "0";
      total += BigInt(amount);
    }
    return total.toString();
  } catch {
    return "0";
  }
}

// ─── Get SOL balance of a wallet ──────────────────────────────────────────────
export async function getSolBalance(walletAddress: string): Promise<string> {
  try {
    const result = await rpc("getBalance", [walletAddress]);
    return (result?.value ?? 0).toString();
  } catch {
    return "0";
  }
}

// ─── Get vault wallet info ────────────────────────────────────────────────────
export async function getVaultWalletInfo(
  vaultWallet: string,
  mintAddress: string
): Promise<{
  sol_balance_lamports: string;
  sol_balance: number;
  total_sol_value: number;
  token_balance_raw: string;
  token_balance: number;
}> {
  const [solLamports, tokenRaw] = await Promise.all([
    getSolBalance(vaultWallet),
    getWalletTokenBalance(vaultWallet, mintAddress),
  ]);

  const sol_balance   = Number(solLamports) / 1e9;
  const token_balance = Number(tokenRaw) / Math.pow(10, DECIMALS);

  return {
    sol_balance_lamports: solLamports,
    sol_balance,
    total_sol_value: sol_balance,
    token_balance_raw: tokenRaw,
    token_balance,
  };
}
