"use client";

import Link from "next/link";

import { useState } from "react";
import Image from "next/image";
import { useWallet } from "@/context/WalletContext";
import {
  POKEMON,
  TYPE_EMOJI,
  assignPokemon,
  getPokemonSprite,
  getEvolutionName,
  fmtBalance,
  fmtSeconds,
} from "@/lib/pokemon";
import type { Holder } from "@/types";
import styles from "./Leaderboard.module.css";

const PAGE_SIZE = 20;

// Show only first 4 + last 4 chars, rest hidden
function maskWallet(w: string): string {
  return `${w.slice(0, 6)}····${w.slice(-4)}`;
}

interface LeaderboardProps {
  holders: Holder[];
  offline: boolean;
}

export default function Leaderboard({ holders, offline }: LeaderboardProps) {
  const { wallet } = useWallet();
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(holders.length / PAGE_SIZE);
  const start      = (page - 1) * PAGE_SIZE;
  const pageItems  = holders.slice(start, start + PAGE_SIZE);

  const myRank = wallet
    ? holders.findIndex((h) => h.wallet.toLowerCase() === wallet.toLowerCase()) + 1
    : null;

  return (
    <section id="leaderboard" className={styles.section}>
      <div className="container">
        <div className={styles.header}>
          <div>
            <h2 className="section-title" style={{ textAlign: "left", marginBottom: 4 }}>
              TRAINER RANKINGS
            </h2>
            <p className="section-sub" style={{ textAlign: "left", marginBottom: 0 }}>
              Score = balance × hold time × evolution multiplier
            </p>
          </div>
          <div className={styles.headerRight}>
            {myRank && myRank > 0 && (
              <div className={styles.myRankBadge}>YOUR RANK: #{myRank}</div>
            )}
            <div className={styles.meta}>
              <span className={`${styles.dot} ${offline ? styles.offline : styles.online}`} />
              <span className={styles.metaText}>
                {holders.length} trainer{holders.length !== 1 ? "s" : ""} ·{" "}
                {offline ? "reconnecting…" : "live"}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>#</span>
            <span>TRAINER</span>
            <span>POKÉMON</span>
            <span>BALANCE</span>
            <span>HOLD TIME</span>
            <span>SHARE</span>
            <span className={styles.right}>EST. PAYOUT</span>
          </div>

          {holders.length === 0 ? (
            <div className={styles.empty}>
              No trainers yet. Buy $PKMN to appear here.
            </div>
          ) : (
            pageItems.map((h, i) => {
              const globalRank = start + i;
              const isMe  = wallet && h.wallet.toLowerCase() === wallet.toLowerCase();
              const pkId  = h.pokemon_id ?? assignPokemon(h.wallet);
              const pk    = POKEMON[pkId];
              const lv    = h.evolution_level ?? 1;
              const rankClass =
                globalRank === 0 ? styles.rank1 :
                globalRank === 1 ? styles.rank2 :
                globalRank === 2 ? styles.rank3 : "";

              return (
                <div
                  key={h.wallet}
                  className={`${styles.row} ${isMe ? styles.myRow : ""} ${styles.rowClickable}`}
                  onClick={() => window.location.href = `/profile?wallet=${h.wallet}`}
                  title="View trainer profile"
                >
                  <div className={`${styles.rankDot} ${rankClass}`}>
                    {globalRank + 1}
                  </div>

                  <div className={styles.trainerCell}>
                    <div className={styles.trainerName}>
                      {/* Show masked wallet — no @ or full address */}
                      <span className={isMe ? styles.meWallet : styles.wallet}>
                        {maskWallet(h.wallet)}
                      </span>
                      {isMe && <span className={styles.youTag}>YOU</span>}
                      {h.callout_verified && (
                        <span className={styles.calloutTag}>🔥</span>
                      )}
                    </div>
                    <div className={styles.trainerSub}>
                      {fmtBalance(h.balance_formatted)} $PKMN
                    </div>
                  </div>

                  <div className={styles.pkCell}>
                    <Image
                      src={getPokemonSprite(pkId, lv)}
                      alt={pk?.name ?? "Pokemon"}
                      width={36}
                      height={36}
                      className={styles.pkSprite}
                    />
                    <div>
                      <div className={styles.pkName}>{getEvolutionName(pkId, lv)}</div>
                      <div className={styles.pkType}>
                        {pk ? `${TYPE_EMOJI[pk.type]} LV.${lv}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className={styles.numCell}>{fmtBalance(h.balance_formatted)}</div>

                  <div className={styles.numCell}>
                    {(h.seconds_held ?? 0) > 0
                      ? fmtSeconds(h.seconds_held)
                      : <span className={styles.dimCell}>—</span>}
                  </div>

                  <div className={styles.shareCell}>
                    <span className={styles.sharePct}>{(h.share_pct ?? 0).toFixed(1)}%</span>
                    <div className={styles.shareBar}>
                      <div
                        className={styles.shareBarFill}
                        style={{ width: `${Math.min(h.share_pct ?? 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className={`${styles.numCell} ${styles.right} ${styles.payoutVal}`}>
                    ${(h.estimated_payout_usd ?? 0).toFixed(2)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button className={styles.pageBtn} onClick={() => setPage(1)} disabled={page === 1}>«</button>
            <button className={styles.pageBtn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹</button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === "…" ? (
                  <span key={`e-${idx}`} className={styles.ellipsis}>…</span>
                ) : (
                  <button
                    key={p}
                    className={`${styles.pageBtn} ${page === p ? styles.pageBtnActive : ""}`}
                    onClick={() => setPage(p as number)}
                  >
                    {p}
                  </button>
                )
              )}

            <button className={styles.pageBtn} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
            <button className={styles.pageBtn} onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>

            <span className={styles.pageInfo}>
              {start + 1}–{Math.min(start + PAGE_SIZE, holders.length)} of {holders.length}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}