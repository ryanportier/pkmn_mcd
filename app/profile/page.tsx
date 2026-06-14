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
  assignPokemon,
  getPokemonSprite,
  getEvolutionProgress,
  getEvolutionName,
  EVOLUTION_THRESHOLDS,
  fmtBalance,
  fmtSeconds,
  shortWallet,
} from "@/lib/pokemon";
import Nav from "@/components/Nav/Nav";
import Footer from "@/components/Footer/Footer";
import styles from "./profile.module.css";

interface ProfileData {
  holder: {
    wallet: string;
    balance_formatted: number;
    seconds_held: number;
    evolution_level: number;
    score: number;
    effective_multiplier: number;
    share_pct: number;
    estimated_payout_usd: number;
    total_sol_earned: number;
    callout_verified: boolean;
    updated_at: string;
  } | null;
  profile: {
    twitter_handle: string | null;
    callout_status: string;
    callout_multiplier: number;
    callout_type: string | null;
    registered_at: string;
  } | null;
  rank: number | null;
  payouts: {
    id: number;
    round_id: number;
    share_pct: number;
    amount_sol: number;
    amount_usd: number;
    won_at: string;
  }[];
}

// Solana pubkeys are base58, 32–44 chars
function isValidSolanaWallet(w: string): boolean {
  return w.length >= 32 && w.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(w);
}

export default function ProfilePage() {
  const params       = useSearchParams();
  const { wallet: myWallet } = useWallet();

  const walletParam  = params.get("wallet");
  const target       = walletParam ?? myWallet ?? "";

  const [data, setData]         = useState<ProfileData | null>(null);
  const [loading, setLoading]   = useState(false);
  const [wallet, setWallet]     = useState(walletParam ?? "");
  const [searched, setSearched] = useState(!!walletParam);

  useEffect(() => {
    if (walletParam) fetchProfile(walletParam);
    else if (myWallet && !walletParam) fetchProfile(myWallet);
  }, [walletParam, myWallet]);

  async function fetchProfile(w: string) {
    if (!w || !isValidSolanaWallet(w)) return;
    setLoading(true);
    try {
      const [trainerRes, profileRes] = await Promise.all([
        fetch(`/api/trainer?wallet=${w}`),
        fetch(`/api/trainer/callout?wallet=${w}`),
      ]);
      const trainer = await trainerRes.json();
      const profile = await profileRes.json();
      setData({ ...trainer, profile: profile ?? null });
      setSearched(true);
    } catch {}
    setLoading(false);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (isValidSolanaWallet(wallet)) fetchProfile(wallet);
  }

  const holder    = data?.holder;
  const pokemonId = target ? assignPokemon(target) : null;
  const pk        = pokemonId ? POKEMON[pokemonId] : null;
  const level     = holder?.evolution_level ?? 1;
  const balance   = holder?.balance_formatted ?? 0;
  const progress  = holder ? getEvolutionProgress(balance, level) : 0;
  const isMe      = myWallet && target && myWallet === target;

  const totalPayouts = data?.payouts.reduce((s, p) => s + p.amount_usd, 0) ?? 0;
  const totalSol     = data?.payouts.reduce((s, p) => s + p.amount_sol, 0) ?? 0;

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className="container">

          {/* Search bar */}
          <div className={styles.searchWrap}>
            <Link href="/" className={styles.back}>← HOME</Link>
            <form className={styles.searchForm} onSubmit={handleSearch}>
              <input
                className={styles.searchInput}
                type="text"
                placeholder="Enter Solana wallet address…"
                value={wallet}
                onChange={(e) => setWallet(e.target.value.trim())}
                spellCheck={false}
              />
              <button type="submit" className={`btn-pixel red ${styles.searchBtn}`}>
                SEARCH
              </button>
            </form>
          </div>

          {loading && (
            <div className={styles.loading}>
              <span className={styles.loadingDot} />
              Loading trainer data…
            </div>
          )}

          {!loading && searched && !data?.holder && (
            <div className={styles.notFound}>
              <div className={styles.notFoundIcon}>❓</div>
              <div className={styles.notFoundTitle}>TRAINER NOT FOUND</div>
              <p className={styles.notFoundText}>
                This wallet doesn&apos;t hold any $PKMN or hasn&apos;t been synced yet.
              </p>
            </div>
          )}

          {!loading && data?.holder && pk && (
            <div className={styles.grid}>

              {/* ── Left: Pokemon card ─────────────────────────────────────── */}
              <div className={styles.pokeCard}>
                <div className={styles.pokeCardInner}>
                  <div
                    className={styles.pokeGlow}
                    style={{ background: `radial-gradient(ellipse at 50% 0%, ${TYPE_COLOR[pk.type]}22, transparent 70%)` }}
                  />
                  <Image
                    src={getPokemonSprite(pokemonId!, level)}
                    alt={pk.name}
                    width={200}
                    height={200}
                    className={styles.pokeSprite}
                    priority
                  />
                  <div className={`type-badge type-${pk.type}`} style={{ marginBottom: 8 }}>
                    {TYPE_EMOJI[pk.type]} {pk.type.toUpperCase()}
                  </div>
                  <div className={styles.pokeName}>{getEvolutionName(pokemonId!, level).toUpperCase()}</div>
                  <div className={styles.pokeRole}>{pk.role}</div>
                  <p className={styles.pokeDesc}>{pk.description}</p>

                  {/* Evolution bar */}
                  <div className={styles.evoWrap}>
                    <div className={styles.evoLabels}>
                      <span className={styles.evoLv}>LV.{level}</span>
                      {level < 5 ? (
                        <span className={styles.evoNext}>
                          NEXT: {fmtBalance(EVOLUTION_THRESHOLDS[level])}+
                        </span>
                      ) : (
                        <span style={{ color: "var(--yellow)", fontFamily: "var(--pixel)", fontSize: 8 }}>MAX ⚡</span>
                      )}
                    </div>
                    <div className={styles.evoBar}>
                      <div
                        className={styles.evoFill}
                        style={{ width: `${progress}%`, background: TYPE_COLOR[pk.type] }}
                      />
                    </div>
                  </div>

                  {holder?.callout_verified && (
                    <div className={styles.calloutBadge}>🔥 CALLOUT VERIFIED · ×{holder?.effective_multiplier}</div>
                  )}
                </div>
              </div>

              {/* ── Right: Stats ───────────────────────────────────────────── */}
              <div className={styles.statsCol}>

                {/* Header */}
                <div className={styles.trainerHeader}>
                  <div className={styles.trainerWallet}>
                    {shortWallet(target)}
                    {isMe && <span className={styles.youTag}>YOU</span>}
                    {data.rank && <span className={styles.rankTag}>RANK #{data.rank}</span>}
                  </div>
                  {data.profile?.twitter_handle && (
                    <a
                      href={`https://x.com/${data.profile.twitter_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.twitterLink}
                    >
                      @{data.profile.twitter_handle} ↗
                    </a>
                  )}
                  {data.profile?.registered_at && (
                    <div className={styles.registeredAt}>
                      Registered {new Date(data.profile.registered_at).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {/* Stats grid */}
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
                    <div className={styles.statVal}>{holder?.score?.toLocaleString()}</div>
                    <div className={styles.statSub}>×{holder?.effective_multiplier} multiplier</div>
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
                    <div className={styles.statVal}>{totalSol.toFixed(6)} SOL</div>
                    <div className={styles.statSub}>${totalPayouts.toFixed(2)} USD all-time</div>
                  </div>
                  <div className={styles.statBox}>
                    <div className={styles.statLabel}>ROUNDS WON</div>
                    <div className={styles.statVal}>{data.payouts.length}</div>
                    <div className={styles.statSub}>vault distributions</div>
                  </div>
                </div>

                {/* Callout status */}
                {data.profile && (
                  <div className={styles.calloutSection}>
                    <div className={styles.calloutTitle}>SOCIAL BONUS</div>
                    {data.profile.callout_status === "approved" ? (
                      <div className={styles.calloutApproved}>
                        ✅ {data.profile.callout_type === "own_post" ? "Own Post" : "Magic Phrase"} · ×{data.profile.callout_multiplier} ACTIVE
                      </div>
                    ) : data.profile.callout_status === "pending" ? (
                      <div className={styles.calloutPending}>
                        ⏳ Tweet submitted · awaiting review
                      </div>
                    ) : (
                      <div className={styles.calloutNone}>
                        No bonus active ·{" "}
                        <Link href="/#register" className={styles.calloutLink}>
                          Tweet to earn ×2 or ×4 →
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {/* Payout history */}
                {data.payouts.length > 0 && (
                  <div className={styles.payoutHistory}>
                    <div className={styles.payoutHistoryTitle}>PAYOUT HISTORY</div>
                    <div className={styles.payoutHead}>
                      <span>ROUND</span>
                      <span>SHARE</span>
                      <span>SOL</span>
                      <span>USD</span>
                      <span>DATE</span>
                    </div>
                    {data.payouts.slice(0, 10).map((p) => (
                      <div key={p.id} className={styles.payoutRow}>
                        <span>#{p.round_id}</span>
                        <span>{p.share_pct.toFixed(1)}%</span>
                        <span>{p.amount_sol.toFixed(6)}</span>
                        <span className={styles.payoutUsd}>${p.amount_usd.toFixed(2)}</span>
                        <span>{new Date(p.won_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {data.payouts.length === 0 && (
                  <div className={styles.noPayouts}>
                    No payouts yet. Hold $PKMN to earn from the vault.
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