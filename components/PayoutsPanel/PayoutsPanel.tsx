"use client";

import { shortWallet } from "@/lib/pokemon";
import type { Payout } from "@/types";
import styles from "./PayoutsPanel.module.css";

interface PayoutsPanelProps {
  payouts: Payout[];
  myWallet: string | null;
}

export default function PayoutsPanel({ payouts, myWallet }: PayoutsPanelProps) {
  const sorted = [...payouts].sort(
    (a, b) => new Date(b.won_at).getTime() - new Date(a.won_at).getTime()
  );

  return (
    <section className={styles.section}>
      <div className="container">
        <h2 className="section-title">RECENT PAYOUTS</h2>
        <p className="section-sub">Last 20 vault distributions</p>

        <div className={styles.panel}>
          <div className={styles.head}>
            <span>WALLET</span>
            <span>ROUND</span>
            <span>SHARE</span>
            <span>ETH</span>
            <span className={styles.right}>USD</span>
          </div>

          {sorted.length === 0 ? (
            <div className={styles.empty}>First payout coming soon…</div>
          ) : (
            sorted.map((p) => {
              const isMe =
                myWallet &&
                p.wallet.toLowerCase() === myWallet.toLowerCase();
              return (
                <div
                  key={p.id}
                  className={`${styles.row} ${isMe ? styles.myRow : ""}`}
                >
                  <div className={styles.wallet}>
                    {shortWallet(p.wallet)}
                    {isMe && <span className={styles.youTag}>YOU</span>}
                  </div>
                  <div className={styles.mono}>#{p.round_id}</div>
                  <div className={styles.mono}>{p.share_pct.toFixed(1)}%</div>
                  <div className={styles.mono}>{p.amount_eth.toFixed(6)}</div>
                  <div className={`${styles.mono} ${styles.right} ${styles.usd}`}>
                    ${p.amount_usd.toFixed(2)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
