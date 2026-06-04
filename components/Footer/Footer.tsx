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
          <a href="https://etherscan.io" target="_blank" rel="noopener noreferrer">
            HOOK ↗
          </a>
          <a href="pokemon_mcp_eth" target="_blank" rel="noopener noreferrer">
            x ↗
          </a>
          <a href="https://t.me" target="_blank" rel="noopener noreferrer">
            CONTRACT ↗
          </a>
        </div>

        <div className={styles.copy}>
          © 2026 $PKMN · Built on{" "}
          <span style={{ color: "var(--blue)" }}>Ethereum</span>
        </div>
      </div>
    </footer>
  );
}
