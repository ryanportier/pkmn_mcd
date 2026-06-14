const DEXSCREENER_BASE = "https://api.dexscreener.com/latest/dex/tokens";

export interface TokenPrice {
  priceUsd: number;
  priceChange24h: number;
  marketCapUsd: number;
  volume24hUsd: number;
  liquidity: number;
  pairAddress: string;
}

const FALLBACK: TokenPrice = {
  priceUsd: 0,
  priceChange24h: 0,
  marketCapUsd: 0,
  volume24hUsd: 0,
  liquidity: 0,
  pairAddress: "",
};

export async function getTokenPrice(mintAddress: string): Promise<TokenPrice> {
  if (!mintAddress) return FALLBACK;

  try {
    const res = await fetch(`${DEXSCREENER_BASE}/${mintAddress}`, {
      next: { revalidate: 30 },
    });

    if (!res.ok) return FALLBACK;

    const data = await res.json();
    const pairs: any[] = data.pairs ?? [];

    // Prefer the Solana pair with highest liquidity
    const solanaPairs = pairs
      .filter((p) => p.chainId === "solana")
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));

    const pair = solanaPairs[0];
    if (!pair) return FALLBACK;

    return {
      priceUsd: parseFloat(pair.priceUsd ?? "0"),
      priceChange24h: pair.priceChange?.h24 ?? 0,
      marketCapUsd: pair.marketCap ?? pair.fdv ?? 0,
      volume24hUsd: pair.volume?.h24 ?? 0,
      liquidity: pair.liquidity?.usd ?? 0,
      pairAddress: pair.pairAddress ?? "",
    };
  } catch {
    return FALLBACK;
  }
}

// ─── SOL price in USD (via SOL/USDC pair on DexScreener) ──────────────────────
// Wrapped SOL mint on Solana
const WSOL_MINT = "So11111111111111111111111111111111111111112";

export async function getSolPriceUsd(): Promise<number> {
  try {
    const res = await fetch(`${DEXSCREENER_BASE}/${WSOL_MINT}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return 150; // fallback
    const data = await res.json();
    const pairs: any[] = data.pairs ?? [];
    const best = pairs
      .filter((p) => p.chainId === "solana")
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    return best ? parseFloat(best.priceUsd ?? "0") || 150 : 150;
  } catch {
    return 150;
  }
}
