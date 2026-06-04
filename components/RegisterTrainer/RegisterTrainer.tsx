"use client";

import { useState } from "react";
import Image from "next/image";
import { assignPokemon, POKEMON, getPokemonSprite, TYPE_EMOJI, shortWallet } from "@/lib/pokemon";
import styles from "./RegisterTrainer.module.css";

type Step = "form" | "checking" | "registered" | "callout" | "submitted";

interface RegisterResult {
  wallet: string;
  pokemon: string;
  level: number;
  balance: number;
  twitter_handle: string | null;
  callout_status: string;
  callout_multiplier: number;
  already_registered: boolean;
}

interface Props {
  magicPhrase: string;
}

export default function RegisterTrainer({ magicPhrase }: Props) {
  const [step, setStep]           = useState<Step>("form");
  const [wallet, setWallet]       = useState("");
  const [twitter, setTwitter]     = useState("");
  const [tweetUrl, setTweetUrl]   = useState("");
  const [calloutType, setCalloutType] = useState<"magic_phrase" | "own_post">("magic_phrase");
  const [result, setResult]       = useState<RegisterResult | null>(null);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);

  const pokemonId = wallet.length === 42 ? assignPokemon(wallet) : null;
  const pokemon   = pokemonId ? POKEMON[pokemonId] : null;

  async function handleRegister() {
    setError("");
    if (!wallet || wallet.length !== 42 || !wallet.startsWith("0x")) {
      setError("Enter a valid wallet address (0x...)");
      return;
    }
    setStep("checking");
    setLoading(true);
    try {
      const res  = await fetch("/api/trainer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, twitter_handle: twitter || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Error registering");
        setStep("form");
        return;
      }
      setResult(data);
      setStep("registered");
    } catch {
      setError("Connection error. Try again.");
      setStep("form");
    } finally {
      setLoading(false);
    }
  }

  async function handleCallout() {
    setError("");
    if (!tweetUrl) { setError("Paste the tweet URL first"); return; }
    setLoading(true);
    try {
      const res  = await fetch("/api/trainer/callout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          tweet_url: tweetUrl,
          callout_type: calloutType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Error submitting");
        return;
      }
      setStep("submitted");
    } catch {
      setError("Connection error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="register" className={styles.section}>
      <div className="container">
        <h2 className="section-title">REGISTER YOUR TRAINER</h2>
        <p className="section-sub">
          Enter your wallet to verify you hold $PKMN — no signature needed.
          Then link your X account to earn bonus multipliers.
        </p>

        <div className={styles.card}>
          {/* ── STEP: FORM ── */}
          {(step === "form" || step === "checking") && (
            <div className={styles.formWrap}>
              {/* Pokemon preview */}
              {pokemon && (
                <div className={styles.preview}>
                  <Image
                    src={getPokemonSprite(pokemonId!, 1)}
                    alt={pokemon.name}
                    width={80}
                    height={80}
                    className={styles.previewSprite}
                  />
                  <div className={styles.previewInfo}>
                    <div className={styles.previewName}>{pokemon.name.toUpperCase()}</div>
                    <div className={`type-badge type-${pokemon.type}`}>
                      {TYPE_EMOJI[pokemon.type]} {pokemon.type.toUpperCase()}
                    </div>
                    <div className={styles.previewRole}>{pokemon.role}</div>
                  </div>
                </div>
              )}

              <div className={styles.field}>
                <label className={styles.label}>WALLET ADDRESS</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="0x..."
                  value={wallet}
                  onChange={(e) => { setWallet(e.target.value.trim()); setError(""); }}
                  disabled={loading}
                  spellCheck={false}
                />
                <div className={styles.fieldHint}>
                  The wallet that holds your $PKMN tokens on Ethereum
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  X (TWITTER) HANDLE <span className={styles.optional}>OPTIONAL</span>
                </label>
                <div className={styles.inputPrefix}>
                  <span className={styles.prefix}>@</span>
                  <input
                    className={`${styles.input} ${styles.inputWithPrefix}`}
                    type="text"
                    placeholder="yourhandle"
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value.replace(/^@/, "").trim())}
                    disabled={loading}
                  />
                </div>
                <div className={styles.fieldHint}>
                  Add your X handle to unlock tweet bonuses later
                </div>
              </div>

              {error && <div className={styles.error}>{error}</div>}

              <button
                className={`btn-pixel red ${styles.submitBtn}`}
                onClick={handleRegister}
                disabled={loading || !wallet}
              >
                {step === "checking" ? (
                  <span className={styles.checking}>
                    <span className={styles.spinner} /> VERIFYING ON CHAIN…
                  </span>
                ) : (
                  "REGISTER TRAINER ▶"
                )}
              </button>

              <div className={styles.noSig}>
                🔒 No wallet connection or signature required
              </div>
            </div>
          )}

          {/* ── STEP: REGISTERED ── */}
          {step === "registered" && result && (
            <div className={styles.successWrap}>
              <div className={styles.successHeader}>
                {result.already_registered ? (
                  <div className={styles.successTitle}>WELCOME BACK, TRAINER!</div>
                ) : (
                  <div className={styles.successTitle}>TRAINER REGISTERED! 🎉</div>
                )}
              </div>

              <div className={styles.trainerCard}>
                <Image
                  src={getPokemonSprite(assignPokemon(result.wallet), result.level)}
                  alt={result.pokemon}
                  width={120}
                  height={120}
                  className={styles.trainerSprite}
                />
                <div className={styles.trainerInfo}>
                  <div className={styles.trainerWallet}>{shortWallet(result.wallet)}</div>
                  <div className={styles.trainerPokemon}>
                    {result.pokemon.toUpperCase()} · LV.{result.level}
                  </div>
                  <div className={styles.trainerBalance}>
                    {result.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} $PKMN
                  </div>
                  {result.twitter_handle && (
                    <div className={styles.trainerTwitter}>@{result.twitter_handle}</div>
                  )}
                </div>
              </div>

              {/* Bonus section */}
              {result.callout_status !== "approved" && (
                <div className={styles.bonusSection}>
                  <div className={styles.bonusTitle}>🚀 EARN BONUS MULTIPLIERS</div>
                  <div className={styles.bonusGrid}>
                    <div
                      className={`${styles.bonusCard} ${calloutType === "magic_phrase" ? styles.bonusSelected : ""}`}
                      onClick={() => setCalloutType("magic_phrase")}
                    >
                      <div className={styles.bonusMult}>×2</div>
                      <div className={styles.bonusLabel}>Tweet the Magic Phrase</div>
                      <div className={styles.bonusPhrase}>"{magicPhrase}"</div>
                    </div>
                    <div
                      className={`${styles.bonusCard} ${calloutType === "own_post" ? styles.bonusSelected : ""}`}
                      onClick={() => setCalloutType("own_post")}
                    >
                      <div className={styles.bonusMult}>×4</div>
                      <div className={styles.bonusLabel}>Your Own Post with CA</div>
                      <div className={styles.bonusPhrase}>Include contract address</div>
                    </div>
                  </div>

                  <button
                    className={`btn-pixel blue ${styles.calloutBtn}`}
                    onClick={() => setStep("callout")}
                  >
                    SUBMIT TWEET FOR BONUS ▶
                  </button>
                </div>
              )}

              {result.callout_status === "approved" && (
                <div className={styles.approvedBanner}>
                  ✅ CALLOUT APPROVED · ×{result.callout_multiplier} MULTIPLIER ACTIVE
                </div>
              )}
            </div>
          )}

          {/* ── STEP: CALLOUT ── */}
          {step === "callout" && (
            <div className={styles.calloutWrap}>
              <button className={styles.backBtn} onClick={() => setStep("registered")}>
                ← BACK
              </button>

              <div className={styles.calloutTitle}>
                {calloutType === "magic_phrase" ? "TWEET THE MAGIC PHRASE" : "POST WITH THE CA"}
              </div>

              {calloutType === "magic_phrase" ? (
                <div className={styles.instructBox}>
                  <div className={styles.instructStep}>1. Click to post on X (pre-filled):</div>
                  <a
                    href={`https://x.com/intent/tweet?text=${encodeURIComponent(`"${magicPhrase}" $PKMN 🎮\n\nCA: ${process.env.NEXT_PUBLIC_PKMN_CONTRACT ?? ""}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.tweetIntentBtn}
                  >
                    🐦 TWEET THIS ON X
                  </a>
                  <div className={styles.previewTweet}>
                    <span className={styles.previewLabel}>PREVIEW:</span>
                    <span className={styles.previewText}>
                      &quot;{magicPhrase}&quot; $PKMN · CA: {(process.env.NEXT_PUBLIC_PKMN_CONTRACT ?? "").slice(0,10)}…
                    </span>
                  </div>
                  <div className={styles.instructStep}>2. After tweeting, paste the tweet URL:</div>
                </div>
              ) : (
                <div className={styles.instructBox}>
                  <div className={styles.instructStep}>1. Click to post on X (pre-filled):</div>
                  <a
                    href={`https://x.com/intent/tweet?text=${encodeURIComponent(`🔥 Holding $PKMN Gotta catch em all! 🎮\n\nCA: ${process.env.NEXT_PUBLIC_PKMN_CONTRACT ?? ""}\n\n#PKMN #Ethereum`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.tweetIntentBtn}
                  >
                    🐦 TWEET THIS ON X
                  </a>
                  <div className={styles.previewTweet}>
                    <span className={styles.previewLabel}>PREVIEW:</span>
                    <span className={styles.previewText}>
                      🔥 Holding $PKMN on Ethereum… CA: {(process.env.NEXT_PUBLIC_PKMN_CONTRACT ?? "").slice(0,10)}…
                    </span>
                  </div>
                  <div className={styles.instructStep}>2. After tweeting, paste the tweet URL:</div>
                </div>
              )}

              <div className={styles.field}>
                <label className={styles.label}>TWEET URL</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="https://x.com/yourhandle/status/..."
                  value={tweetUrl}
                  onChange={(e) => { setTweetUrl(e.target.value.trim()); setError(""); }}
                  disabled={loading}
                />
              </div>

              {error && <div className={styles.error}>{error}</div>}

              <button
                className={`btn-pixel red ${styles.submitBtn}`}
                onClick={handleCallout}
                disabled={loading || !tweetUrl}
              >
                {loading ? "SUBMITTING…" : "SUBMIT FOR REVIEW ▶"}
              </button>

              <div className={styles.reviewNote}>
                ⏱ Professor Oak reviews submissions within 24h
              </div>
            </div>
          )}

          {/* ── STEP: SUBMITTED ── */}
          {step === "submitted" && (
            <div className={styles.submittedWrap}>
              <div className={styles.submittedIcon}>🔬</div>
              <div className={styles.submittedTitle}>TWEET SUBMITTED!</div>
              <p className={styles.submittedText}>
                Professor Oak is reviewing your tweet. Once approved, your
                {calloutType === "own_post" ? " ×4" : " ×2"} multiplier will activate automatically.
              </p>
              <div className={styles.submittedNote}>
                Usually approved within 24 hours.
              </div>
              <button
                className={`btn-pixel blue`}
                onClick={() => { setStep("form"); setWallet(""); setTwitter(""); setTweetUrl(""); setResult(null); }}
              >
                REGISTER ANOTHER ▶
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}