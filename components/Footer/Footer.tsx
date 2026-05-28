import styles from "./Footer.module.css";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.logo}>
          <Image src="/pkmn_mcd.png" alt="$PKMN" width={22} height={22} className={styles.logo_img} />
          <span>$PKMN</span>
        </div>

        <div className={styles.links}>
          <a href="https://basescan.org" target="_blank" rel="noopener noreferrer">
            BANKR ↗
          </a>
          <a href="https://x.com/pokemon_mcd" target="_blank" rel="noopener noreferrer">
            TWITTER ↗
          </a>
          <a href="https://t.me" target="_blank" rel="noopener noreferrer">
            CONTRACT ↗
          </a>
        </div>

        <div className={styles.copy}>
          © 2026 $PKMN · Built on{" "}
          <span style={{ color: "var(--blue)" }}>Base</span>
        </div>
      </div>
    </footer>
  );
}
