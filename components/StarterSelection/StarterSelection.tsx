"use client";

import Image from "next/image";
import { useWallet } from "@/context/WalletContext";
import {
  POKEMON,
  STARTER_IDS,
  TYPE_COLOR,
  TYPE_EMOJI,
  assignPokemon,
  getPokemonSprite,
  getEvolutionLevel,
  getEvolutionProgress,
  EVOLUTION_THRESHOLDS,
  fmtBalance,
} from "@/lib/pokemon";
import type { Holder } from "@/types";
import styles from "./StarterSelection.module.css";

interface StarterSelectionProps {
  myHolder: Holder | null;
}

export default function StarterSelection({ myHolder }: StarterSelectionProps) {
  const { wallet, connect, isConnecting } = useWallet();

  const assignedId = wallet ? assignPokemon(wallet) : null;
  const balance = myHolder?.balance_formatted ?? 0;
  const level = myHolder?.evolution_level ?? 1;
  const progress = getEvolutionProgress(balance, level);
  const secondsHeld = myHolder?.seconds_held ?? 0;

  return (
    <section id="starter" className={styles.section}>
      <div className="container">
        <h2 className="section-title">CHOOSE YOUR STARTER</h2>
        <p className="section-sub">
          Your wallet deterministically assigns you a Pokémon. Hold $PKMN to evolve it.
        </p>

        <div className={styles.grid}>
          {STARTER_IDS.map((id) => {
            const pk = POKEMON[id];
            const isChosen = assignedId === id;
            const spriteUrl = isChosen
              ? getPokemonSprite(id, level)
              : pk.spriteUrl;

            return (
              <div
                key={id}
                className={`${styles.card} ${styles[pk.type]} ${isChosen ? styles.chosen : ""}`}
                onClick={!wallet ? connect : undefined}
                role={!wallet ? "button" : undefined}
              >
                {isChosen && (
                  <div className={styles.chosenTag}>YOURS</div>
                )}

                <div className={styles.spriteBox}>
                  <Image
                    src={spriteUrl}
                    alt={pk.name}
                    width={140}
                    height={140}
                    className={`${styles.sprite} ${isChosen ? styles[`glow${level}`] : ""}`}
                    priority={isChosen}
                  />
                </div>

                <div className={styles.num}>#{String(id).padStart(3, "0")}</div>
                <div className={styles.name}>{pk.name.toUpperCase()}</div>

                <div className={`type-badge type-${pk.type}`} style={{ marginBottom: 10 }}>
                  {TYPE_EMOJI[pk.type]} {pk.type.toUpperCase()}
                </div>

                <div className={styles.role}>{pk.role}</div>
                <p className={styles.desc}>{pk.description}</p>

                {isChosen && wallet && (
                  <div className={styles.trainerInfo}>
                    <div className={styles.levelRow}>
                      <span className={styles.levelLabel}>LV.{level}</span>
                      <span className={styles.balanceVal}>{fmtBalance(balance)} $PKMN</span>
                    </div>
                    <div className={styles.evoBarWrap}>
                      <div
                        className={styles.evoBarFill}
                        style={{
                          width: `${progress}%`,
                          background: TYPE_COLOR[pk.type],
                        }}
                      />
                    </div>
                    {level < 5 && (
                      <div className={styles.evoNext}>
                        NEXT EVO: {fmtBalance(EVOLUTION_THRESHOLDS[level])} $PKMN
                      </div>
                    )}
                  </div>
                )}

                {!wallet && (
                  <button
                    className={`btn-pixel ${pk.type === "fire" ? "red" : pk.type === "water" ? "blue" : "green"} ${styles.chooseBtn}`}
                    disabled={isConnecting}
                  >
                    {isConnecting ? "…" : "CONNECT TO REVEAL"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {!wallet && (
          <p className={styles.hint}>
            Connect your wallet to reveal which Pokémon chose you.
          </p>
        )}
      </div>
    </section>
  );
}
