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

export async function getTokenPrice(
  contractAddress: string
): Promise<TokenPrice> {
  if (
    !contractAddress ||
    contractAddress === "0x0000000000000000000000000000000000000000"
  ) {
    return FALLBACK;
  }

  try {
    const res = await fetch(`${DEXSCREENER_BASE}/${contractAddress}`, {
      next: { revalidate: 30 }, // cache 30s in Next.js
    });

    if (!res.ok) return FALLBACK;

    const data = await res.json();
    const pairs: any[] = data.pairs ?? [];

    // Prefer the Base chain pair with highest liquidity
    const basePairs = pairs
      .filter((p) => p.chainId === "base")
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));

    const pair = basePairs[0];
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
