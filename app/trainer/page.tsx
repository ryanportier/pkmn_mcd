"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useWallet } from "@/context/WalletContext";
import {
  POKEMON,
  TYPE_EMOJI,
  TYPE_COLOR,
  getPokemonSprite,
  getEvolutionProgress,
  EVOLUTION_THRESHOLDS,
  fmtBalance,
  fmtSeconds,
  shortWallet,
} from "@/lib/pokemon";
import type { TrainerData } from "@/types";
import Nav from "@/components/Nav/Nav";
import Footer from "@/components/Footer/Footer";
import styles from "./trainer.module.css";

export default function TrainerPage() {
  const params = useSearchParams();
  const walletParam = params.get("wallet");
  const { wallet: myWallet } = useWallet();

  const targetWallet = walletParam ?? myWallet;

  const [data, setData] = useState<TrainerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetWallet) { setLoading(false); return; }
    fetch(`/api/trainer?wallet=${targetWallet}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [targetWallet]);

  const holder = data?.holder;
  const pokemon = data?.pokemon;
  const level = holder?.evolution_level ?? 1;
  const balance = holder?.balance_formatted ?? 0;
  const progress = getEvolutionProgress(balance, level);

  if (!targetWallet) {
    return (
      <>
        <Nav />
        <main className={styles.main}>
          <div className={styles.empty}>
            <p>Connect your wallet to view your trainer profile.</p>
            <Link href="/" className={`btn-pixel blue`}>← BACK HOME</Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className="container">
          <Link href="/" className={styles.back}>← BACK</Link>

          {loading ? (
            <div className={styles.loading}>Loading trainer data…</div>
          ) : (
            <div className={styles.grid}>
              {/* Pokemon card */}
              <div className={styles.card}>
                {pokemon && holder ? (
                  <>
                    <div className={styles.spriteWrap}>
                      <Image
                        src={getPokemonSprite(pokemon.id, level)}
                        alt={pokemon.name}
                        width={220}
                        height={220}
                        className={styles.sprite}
                        priority
                      />
                    </div>
                    <div className={`type-badge type-${pokemon.type}`} style={{ marginBottom: 8 }}>
                      {TYPE_EMOJI[pokemon.type]} {pokemon.type.toUpperCase()}
                    </div>
                    <div className={styles.pkName}>{pokemon.name.toUpperCase()}</div>
                    <div className={styles.pkRole}>{pokemon.role}</div>
                    <p className={styles.pkDesc}>{pokemon.description}</p>

                    <div className={styles.evoWrap}>
                      <div className={styles.evoLabels}>
                        <span>LV.{level}</span>
                        {level < 5 && (
                          <span className={styles.evoNext}>
                            NEXT: {fmtBalance(EVOLUTION_THRESHOLDS[level])}+
                          </span>
                        )}
                        {level >= 5 && <span style={{ color: "var(--yellow)" }}>MAX LEVEL ⚡</span>}
                      </div>
                      <div className={styles.evoBar}>
                        <div
                          className={styles.evoFill}
                          style={{
                            width: `${progress}%`,
                            background: TYPE_COLOR[pokemon.type],
                          }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={styles.noPokemon}>
                    <div className={styles.pokeball} />
                    <p>No $PKMN held yet</p>
                    <p style={{ fontSize: 12, color: "var(--text-dim2)", marginTop: 8 }}>
                      Buy $PKMN on Ethereum to get your Pokémon
                    </p>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className={styles.statsCol}>
                <div className={styles.walletRow}>
                  <span className={styles.walletAddr}>{shortWallet(targetWallet)}</span>
                  {myWallet?.toLowerCase() === targetWallet.toLowerCase() && (
                    <span className={styles.youTag}>YOU</span>
                  )}
                  {data?.rank && (
                    <span className={styles.rankBadge}>RANK #{data.rank}</span>
                  )}
                </div>

                <div className={styles.statsGrid}>
                  <div className={styles.statBox}>
                    <div className={styles.statLabel}>BALANCE</div>
                    <div className={styles.statVal}>{fmtBalance(balance)}</div>
                    <div className={styles.statSub}>$PKMN tokens</div>
                  </div>
                  <div className={styles.statBox}>
                    <div className={styles.statLabel}>HOLD TIME</div>
                    <div className={styles.statVal}>{fmtSeconds(holder?.seconds_held ?? 0)}</div>
                    <div className={styles.statSub}>resets on sell</div>
                  </div>
                  <div className={styles.statBox}>
                    <div className={styles.statLabel}>SCORE</div>
                    <div className={styles.statVal}>{(holder?.score ?? 0).toLocaleString()}</div>
                    <div className={styles.statSub}>×{holder?.effective_multiplier ?? 1} mult</div>
                  </div>
                  <div className={styles.statBox}>
                    <div className={styles.statLabel}>YOUR SHARE</div>
                    <div className={styles.statVal} style={{ color: "var(--green)" }}>
                      {(holder?.share_pct ?? 0).toFixed(2)}%
                    </div>
                    <div className={styles.statSub}>
                      ≈ ${(holder?.estimated_payout_usd ?? 0).toFixed(2)} next payout
                    </div>
                  </div>
                  <div className={styles.statBox}>
                    <div className={styles.statLabel}>TOTAL EARNED</div>
                    <div className={styles.statVal}>{(holder?.total_eth_earned ?? 0).toFixed(6)}</div>
                    <div className={styles.statSub}>ETH all-time</div>
                  </div>
                  <div className={styles.statBox}>
                    <div className={styles.statLabel}>EVOLUTION</div>
                    <div className={styles.statVal}>LV.{level} / LV.5</div>
                    <div className={styles.statSub}>{progress.toFixed(0)}% to next</div>
                  </div>
                </div>

                {/* Payout history */}
                {data?.payouts && data.payouts.length > 0 && (
                  <div className={styles.payoutHistory}>
                    <div className={styles.payoutTitle}>PAYOUT HISTORY</div>
                    {data.payouts.slice(0, 10).map((p) => (
                      <div key={p.id} className={styles.payoutRow}>
                        <span className={styles.payoutRound}>Round #{p.round_id}</span>
                        <span className={styles.payoutShare}>{p.share_pct.toFixed(1)}%</span>
                        <span className={styles.payoutAmt}>${p.amount_usd.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
