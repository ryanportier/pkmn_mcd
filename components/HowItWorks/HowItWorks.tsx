import styles from "./HowItWorks.module.css";

const STEPS = [
  {
    n: "01",
    title: "Buy $PKMN on Base",
    body: "Grab $PKMN on any Base DEX (Uniswap, Aerodrome). Connect your wallet to reveal which Pokémon is yours.",
    code: "base-mainnet",
  },
  {
    n: "02",
    title: "Hold to Evolve",
    body: "Your score grows with your balance and hold time. The more you hold, the higher your evolution level and score multiplier.",
    code: "score = balance × time × ×mult",
  },
  {
    n: "03",
    title: "Tweet & Boost",
    body: "Register your wallet and tweet the magic phrase to get ×2 multiplier. Post your own $PKMN call with the CA to earn ×4. More multiplier = bigger vault share.",
    code: "magic phrase → ×2  |  own post → ×4",
  },
  {
    n: "04",
    title: "Earn from the Vault",
    body: "Every round, trading fees fill the vault. When the timer hits zero, holders split the vault proportional to their score.",
    code: "payout = your_score / total_scores × vault",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className={styles.section}>
      <div className="container">
        <h2 className="section-title">HOW IT WORKS</h2>
        <p className="section-sub">Four steps to become a Pokémon Master</p>

        <div className={styles.grid}>
          {STEPS.map((s) => (
            <div key={s.n} className={styles.card}>
              <div className={styles.num} data-n={s.n}>
                STEP {s.n}
              </div>
              <h3 className={styles.title}>{s.title}</h3>
              <p className={styles.body}>{s.body}</p>
              <div className={styles.code}>{s.code}</div>
            </div>
          ))}
        </div>

        <div className={styles.warn}>
          ⚠️ $PKMN is a meme token for entertainment. Not financial advice.
          Never invest more than you can afford to lose.
        </div>
      </div>
    </section>
  );
}