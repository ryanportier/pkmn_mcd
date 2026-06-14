"use client";

import Image from "next/image";
import Link from "next/link";
import { useWallet } from "@/context/WalletContext";
import { shortWallet } from "@/lib/pokemon";
import styles from "./Nav.module.css";

export default function Nav() {
  const { wallet, isConnected, isConnecting, connect, disconnect } =
    useWallet();

  return (
    <nav className={styles.nav}>
      <div className={`container ${styles.container}`}>
        <Link href="/" className={styles.logo}>
          <Image src="/pkmn_mcd.png" alt="$PKMN" width={28} height={28} className={styles.logo_img} />
          <span>$PKMN</span>
        </Link>

        <div className={styles.links}>
          <Link href="/#how">HOW IT WORKS</Link>
          <Link href="/#leaderboard">TRAINERS</Link>
          <Link href="/#vault">VAULT</Link>
          <Link href="/#register">REGISTER</Link>
          <Link href="/profile">PROFILE</Link>
          <Link href="/#agent">OAK</Link>
        </div>

        <div className={styles.right}>
          <div className={styles.livePill}>
            <span className={styles.liveDot} />
            SOLANA MAINNET
          </div>

          {isConnected && wallet ? (
            <div className={styles.walletChip}>
              <span className={styles.walletAddr}>{shortWallet(wallet)}</span>
              <button onClick={disconnect} className={styles.disconnectBtn}>
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={isConnecting}
              className={styles.connectBtn}
            >
              {isConnecting ? "CONNECTING…" : "CONNECT"}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
