"use client";

import { useState } from "react";
import Image from "next/image";
import { useWallet } from "@/context/WalletContext";
import styles from "./Hero.module.css";

interface HeroProps {
  magicPhrase: string;
  contract: string;
  shiftsCompleted: number;
}

export default function Hero({ magicPhrase, contract, shiftsCompleted }: HeroProps) {
  const { connect, isConnected, isConnecting } = useWallet();
  const [copied, setCopied] = useState(false);

  const isPlaceholder =
    contract === "0x0000000000000000000000000000000000000000";
  const displayCA = isPlaceholder ? "soon™" : contract;

  function copyCA() {
    if (isPlaceholder) return;
    navigator.clipboard.writeText(contract).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section className={styles.hero}>
      <div className="container">
        <div className={styles.eyebrow}>
          ⚡ NOW LIVE ON BASE · ROUND #{shiftsCompleted + 1}
        </div>

        <h1 className={styles.h1}>
          <span className={styles.red}>CATCH.</span>{" "}
          <Image src="/pkmn_mcd.png" alt="" width={38} height={38} className={styles.logo_inline} aria-hidden="true" />
          EVOLVE.{" "}
          <span className={styles.green}>EARN.</span>
        </h1>

        <p className={styles.sub}>
          Hold <code className={styles.ticker}>$PKMN</code> on Base, evolve your
          trainer Pokémon, and earn ETH from the vault every round.
          The longer you hold, the stronger you become.
        </p>

        <div className={styles.magicPhrase}>
          <span className={styles.magicLabel}>MAGIC PHRASE</span>
          <span className={styles.magicValue}>&quot;{magicPhrase}&quot;</span>
        </div>

        {/* CA strip */}
        <div className={styles.caStrip} onClick={copyCA} role="button" tabIndex={0}>
          <span className={styles.caLabel}>CA</span>
          <span className={styles.caVal}>{displayCA}</span>
          {!isPlaceholder && (
            <button className={styles.caCopy} onClick={(e) => { e.stopPropagation(); copyCA(); }}>
              {copied ? "✓" : "COPY"}
            </button>
          )}
        </div>

        <div className={styles.btns}>
          {!isConnected ? (
            <button
              className={`btn-pixel red ${styles.btn}`}
              onClick={connect}
              disabled={isConnecting}
            >
              {isConnecting ? "CONNECTING…" : "CONNECT WALLET"}
            </button>
          ) : (
            <button
              className={`btn-pixel green ${styles.btn}`}
              onClick={() => scrollTo("starter")}
            >
              VIEW YOUR POKÉMON ↓
            </button>
          )}
          <button
            className={`btn-pixel blue ${styles.btn}`}
            onClick={() => scrollTo("vault")}
          >
            ENTER VAULT
          </button>
        </div>
      </div>
    </section>
  );
}
