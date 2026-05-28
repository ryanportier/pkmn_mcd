"use client";

import { useState, useEffect } from "react";
import type { VaultRound, Holder } from "@/types";
import { fmtBalance, fmtSeconds } from "@/lib/pokemon";
import styles from "./VaultCountdown.module.css";

interface VaultCountdownProps {
  vault: VaultRound | null;
  holders: Holder[];
  myHolder: Holder | null;
  tokenPriceUsd: number;
  shiftsCompleted: number;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export default function VaultCountdown({
  vault,
  holders,
  myHolder,
  tokenPriceUsd,
  shiftsCompleted,
}: VaultCountdownProps) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!vault?.ends_at) return;

    function tick() {
      const diff = new Date(vault!.ends_at).getTime() - Date.now();
      setRemaining(Math.max(0, diff));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [vault?.ends_at]);

  const duration =
    vault
      ? new Date(vault.ends_at).getTime() -
        new Date(vault.starts_at).getTime()
      : 3_600_000;
  const progress =
    duration > 0 ? ((duration - remaining) / duration) * 100 : 0;

  const totalHolders = holders.filter((h) => h.balance_formatted > 0).length;
  const totalVaultUsd = vault?.total_usd ?? 0;
  const myPayout = myHolder?.estimated_payout_usd ?? 0;
  const myShare = myHolder?.share_pct ?? 0;

  return (
    <section id="vault" className={styles.section}>
      <div className="container">
        <h2 className="section-title">VAULT STATUS</h2>
        <p className="section-sub">
          Every round, fees fill the vault. Top holders by score split the rewards.
        </p>

        <div className={styles.countdown}>
          {/* Timer */}
          <div className={styles.mainTimer}>
            <div className={styles.label}>NEXT PAYOUT IN</div>
            <div className={`${styles.timer} ${remaining < 300_000 ? styles.urgent : ""}`}>
              {formatCountdown(remaining)}
            </div>
            <div className={styles.bar}>
              <div className={styles.barFill} style={{ width: `${progress}%` }} />
            </div>
            <div className={styles.barMeta}>
              <span>ROUND #{shiftsCompleted + 1}</span>
              <span>{shiftsCompleted} COMPLETED</span>
            </div>
          </div>

          {/* Stats */}
          <div className={styles.stat}>
            <div className={styles.statLabel}>VAULT SIZE</div>
            <div className={styles.statVal}>
              ${totalVaultUsd > 0 ? totalVaultUsd.toFixed(2) : "—"}
            </div>
            <div className={styles.statSub}>ETH accumulated</div>
          </div>

          <div className={styles.stat}>
            <div className={styles.statLabel}>TRAINERS</div>
            <div className={styles.statVal}>{totalHolders}</div>
            <div className={styles.statSub}>eligible holders</div>
          </div>

          <div className={styles.stat}>
            <div className={styles.statLabel}>YOUR SHARE</div>
            <div className={styles.statVal} style={{ color: myShare > 0 ? "var(--green)" : undefined }}>
              {myShare > 0 ? `${myShare.toFixed(2)}%` : "—"}
            </div>
            <div className={styles.statSub}>
              {myPayout > 0 ? `≈ $${myPayout.toFixed(2)}` : "hold $PKMN to earn"}
            </div>
          </div>
        </div>

        {/* Evolution table */}
        <h3 className={styles.evoTitle}>EVOLUTION LEVELS</h3>
        <div className={styles.evoTable}>
          {[1, 2, 3, 4, 5].map((lv) => {
            const myLv = myHolder?.evolution_level ?? 0;
            const threshold = lv === 1 ? "0" : fmtBalance([0, 1000, 10000, 100000, 1000000][lv - 1]);
            return (
              <div
                key={lv}
                className={`${styles.evoCell} ${myLv === lv ? styles.activeCell : ""}`}
              >
                <div className={styles.evoCellLv}>LV.{lv}</div>
                <div className={styles.evoCellBal}>{threshold}+</div>
                <div className={styles.evoCellMult}>×{lv} score</div>
                <div className={styles.evoCellBar}>
                  <div
                    className={styles.evoCellFill}
                    style={{ width: myLv >= lv ? "100%" : "0%" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
