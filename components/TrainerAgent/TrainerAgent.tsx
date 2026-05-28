"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useWallet } from "@/context/WalletContext";
import { useAgent } from "@/hooks/useAgent";
import { assignPokemon, POKEMON, TYPE_EMOJI, shortWallet } from "@/lib/pokemon";
import styles from "./TrainerAgent.module.css";

// Prof Oak sprite from PokeAPI trainer sprites
const OAK_SPRITE = "/oak.png";

const TOOL_LABELS: Record<string, string> = {
  get_trainer_status:     "Checking your trainer card…",
  get_vault_status:       "Inspecting the vault…",
  get_leaderboard:        "Reading the rankings…",
  get_token_price:        "Checking the Pokédex market…",
  calculate_swap_needed:  "Running calculations…",
  save_strategy:          "Saving your strategy…",
  get_payout_history:     "Reviewing your earnings…",
  open_tweet_intent:      "Generating tweet link…",
  check_claimable_payout: "Checking your claimable rewards…",
  open_base_mcp_swap:     "Generating swap link…",
};

const SUGGESTIONS = [
  "What's my current evolution level?",
  "How much ETH to reach LV.3?",
  "Show me the top 5 trainers",
  "How long until the next payout?",
  "Help me tweet the magic phrase",
  "I want to buy more $PKMN to evolve faster",
  "Do I have any rewards to claim?",
  "Am I going to earn anything this round?",
];

export default function TrainerAgent() {
  const { wallet, connect, isConnected } = useWallet();
  const { messages, isStreaming, activeTools, sendMessage, clearMessages, stop } =
    useAgent(wallet);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [sentIntro, setSentIntro] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const pokemonId = wallet ? assignPokemon(wallet) : null;
  const pokemon = pokemonId ? POKEMON[pokemonId] : null;

  // Auto-send intro message when chat opens and wallet is connected
  useEffect(() => {
    if (isOpen && wallet && messages.length === 0 && !sentIntro && !isStreaming) {
      setSentIntro(true);
      sendMessage(`My wallet is ${wallet}. Analyze my position, tell me my evolution level, how close I am to the next level, and suggest what I should do next.`);
    }
  }, [isOpen, wallet, messages.length, sentIntro, isStreaming]);

  // Reset intro flag when chat is cleared
  useEffect(() => {
    if (messages.length === 0) setSentIntro(false);
  }, [messages.length]);

  function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    sendMessage(text);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <section id="agent" className={styles.section}>
      <div className="container">
        {/* Header toggle */}
        <div className={styles.header} onClick={() => setIsOpen((v) => !v)}>
          <div className={styles.oakPreview}>
            <div className={styles.oakAvatarSmall}>
              <Image
                src={OAK_SPRITE}
                alt="Professor Oak"
                width={48}
                height={48}
                className={styles.oakSpriteSmall}
              />
              <span className={styles.oakOnlineDot} />
            </div>
            <div>
              <div className={styles.headerTitle}>PROFESSOR OAK</div>
              <div className={styles.headerSub}>
                AI Trainer Agent · Powered by BankrBot
              </div>
            </div>
          </div>
          <div className={styles.headerRight}>
            {isStreaming && (
              <span className={styles.thinkingPill}>
                <span className={styles.thinkingDot} />
                THINKING…
              </span>
            )}
            <span className={styles.chevron}>{isOpen ? "▲" : "▼"}</span>
          </div>
        </div>

        {isOpen && (
          <div className={styles.panel}>
            {/* Oak intro bar */}
            <div className={styles.oakBar}>
              <div className={styles.oakAvatarWrap}>
                <Image
                  src={OAK_SPRITE}
                  alt="Professor Oak"
                  width={80}
                  height={80}
                  className={styles.oakSprite}
                  priority
                />
              </div>
              <div className={styles.oakIntro}>
                <div className={styles.oakName}>PROF. OAK</div>
                <div className={styles.oakDesc}>
                  {isConnected && pokemon ? (
                    <>
                      Ah, Trainer! Your{" "}
                      <span style={{ color: `var(--${pokemon.type === "fire" ? "red" : pokemon.type === "water" ? "blue" : "green"})` }}>
                        {TYPE_EMOJI[pokemon.type]} {pokemon.name}
                      </span>{" "}
                      is counting on you. Ask me anything about your position,
                      the vault, or the leaderboard.
                    </>
                  ) : (
                    "Connect your wallet and I'll analyze your trainer status, vault position, and help you build a winning strategy!"
                  )}
                </div>
                {isConnected && wallet && (
                  <div className={styles.walletBadge}>
                    {shortWallet(wallet)}
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className={styles.messages}>
              {messages.length === 0 && (
                <div className={styles.emptyState}>
                  {wallet ? (
                    // Wallet connected — show loading spinner while intro sends
                    <div className={styles.emptyLoading}>
                      <span className={styles.emptySpinner} />
                      <p className={styles.emptyText}>
                        Analyzing your trainer data…
                      </p>
                    </div>
                  ) : (
                    // No wallet — show suggestions
                    <>
                      <div className={styles.emptyIcon}>🔬</div>
                      <p className={styles.emptyText}>
                        Connect your wallet so Professor Oak can analyze your position!
                      </p>
                      <div className={styles.suggestions}>
                        {SUGGESTIONS.map((s) => (
                          <button
                            key={s}
                            className={styles.suggBtn}
                            onClick={() => sendMessage(s)}
                            disabled={isStreaming}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`${styles.msgRow} ${
                    msg.role === "oak" ? styles.oakRow : styles.trainerRow
                  }`}
                >
                  {msg.role === "oak" && (
                    <div className={styles.msgAvatar}>
                      <Image
                        src={OAK_SPRITE}
                        alt="Oak"
                        width={32}
                        height={32}
                        className={styles.msgAvatarImg}
                      />
                    </div>
                  )}

                  <div className={styles.msgBubbleWrap}>
                    {msg.tool_used && (
                      <div className={styles.toolBadge}>
                        🔬 {TOOL_LABELS[msg.tool_used] ?? msg.tool_used}
                      </div>
                    )}
                    <div
                      className={`${styles.bubble} ${
                        msg.role === "oak" ? styles.oakBubble : styles.trainerBubble
                      }`}
                    >
                      {msg.content || (
                        <span className={styles.cursor}>▋</span>
                      )}
                    </div>

                    {/* Action buttons from tool results */}
                    {msg.tool_result && (
                      <div className={styles.actionBtns}>
                        {(msg.tool_result as any).tweet_url && (
                          <a
                            href={(msg.tool_result as any).tweet_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.actionBtn}
                            style={{ borderColor: "#1d9bf0", color: "#1d9bf0" }}
                          >
                            🐦 TWEET FOR ×{(msg.tool_result as any).multiplier} BONUS
                          </a>
                        )}
                        {(msg.tool_result as any).uniswap_url && (
                          <a
                            href={(msg.tool_result as any).uniswap_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.actionBtn}
                            style={{ borderColor: "var(--purple)", color: "var(--purple)" }}
                          >
                            🔄 SWAP ON UNISWAP
                          </a>
                        )}
                        {(msg.tool_result as any).base_app_url && (
                          <a
                            href={(msg.tool_result as any).base_app_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.actionBtn}
                            style={{ borderColor: "var(--blue)", color: "var(--blue)" }}
                          >
                            🔵 SWAP ON BASE APP
                          </a>
                        )}
                      </div>
                    )}

                    <div className={styles.msgTime}>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>

                  {msg.role === "trainer" && (
                    <div className={styles.trainerAvatar}>
                      {pokemon
                        ? TYPE_EMOJI[pokemon.type]
                        : "🎮"}
                    </div>
                  )}
                </div>
              ))}

              {/* Active tool indicators */}
              {activeTools.map((tool) => (
                <div key={tool} className={`${styles.msgRow} ${styles.oakRow}`}>
                  <div className={styles.msgAvatar}>
                    <Image src={OAK_SPRITE} alt="Oak" width={32} height={32} className={styles.msgAvatarImg} />
                  </div>
                  <div className={styles.toolPill}>
                    <span className={styles.toolSpinner} />
                    {TOOL_LABELS[tool] ?? tool}
                  </div>
                </div>
              ))}

              <div ref={bottomRef} />
            </div>

            {/* Quick suggestions after intro — show when Oak has responded and not streaming */}
            {messages.length > 0 && !isStreaming && wallet && (
              <div className={styles.postSuggestions}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className={styles.suggBtnSmall}
                    onClick={() => sendMessage(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input area */}
            <div className={styles.inputArea}>
              {!isConnected ? (
                <div className={styles.connectPrompt}>
                  <span>Connect wallet to talk to Professor Oak</span>
                  <button className={`btn-pixel red`} onClick={connect}>
                    CONNECT
                  </button>
                </div>
              ) : (
                <>
                  <textarea
                    ref={inputRef}
                    className={styles.input}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Ask Professor Oak… (Enter to send)"
                    rows={1}
                    disabled={isStreaming}
                  />
                  <div className={styles.inputActions}>
                    {isStreaming ? (
                      <button className={styles.stopBtn} onClick={stop}>
                        ⬛ STOP
                      </button>
                    ) : (
                      <button
                        className={styles.sendBtn}
                        onClick={handleSend}
                        disabled={!input.trim()}
                      >
                        SEND ▶
                      </button>
                    )}
                    {messages.length > 0 && !isStreaming && (
                      <button className={styles.clearBtn} onClick={clearMessages}>
                        CLEAR
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}