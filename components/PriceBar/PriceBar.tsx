"use client";

import styles from "./PriceBar.module.css";

interface PriceBarProps {
  priceUsd: number;
  priceChange24h: number;
  marketCapUsd: number;
  volume24hUsd: number;
  contract: string;
}

function fmt(n: number, decimals = 2): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(decimals)}`;
}

function fmtPrice(n: number): string {
  if (n === 0) return "$—";
  if (n < 0.000001) return `$${n.toExponential(3)}`;
  if (n < 0.01) return `$${n.toFixed(8)}`;
  return `$${n.toFixed(6)}`;
}

export default function PriceBar({
  priceUsd,
  priceChange24h,
  marketCapUsd,
  volume24hUsd,
  contract,
}: PriceBarProps) {
  const isUp = priceChange24h >= 0;
  const dexLink =
    contract !== "0x0000000000000000000000000000000000000000"
      ? `https://dexscreener.com/solana/${contract}`
      : "#";

  return (
    <div className={styles.bar}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.item}>
          <span className={styles.label}>$PKMN</span>
          <span className={styles.price}>{fmtPrice(priceUsd)}</span>
          <span className={`${styles.change} ${isUp ? styles.up : styles.down}`}>
            {isUp ? "▲" : "▼"} {Math.abs(priceChange24h).toFixed(2)}%
          </span>
        </div>
        <div className={styles.divider} />
        <div className={styles.item}>
          <span className={styles.label}>MCAP</span>
          <span className={styles.value}>{fmt(marketCapUsd)}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.item}>
          <span className={styles.label}>VOL 24H</span>
          <span className={styles.value}>{fmt(volume24hUsd)}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.item}>
          <span className={styles.label}>CHAIN</span>
          <span className={styles.value} style={{ color: "var(--blue)" }}>
            SOLANA
          </span>
        </div>
        <a
          href={dexLink}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.dexLink}
        >
          DEXSCREENER ↗
        </a>
      </div>
    </div>
  );
}
