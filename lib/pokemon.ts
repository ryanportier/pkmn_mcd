import type { Pokemon, PokemonType } from "@/types";

// ─── Sprites from PokeAPI (official artwork) ──────────────────────────────────
const SPRITE = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

// Evolution chains: [base, lv2, lv3, lv4, lv5]
// Fire:  Charmander → Charmeleon → Charizard → Mega Charizard X → Mega Charizard Y
// Water: Squirtle → Wartortle → Blastoise → Mega Blastoise → Blastoise-Gmax
// Grass: Bulbasaur → Ivysaur → Venusaur → Mega Venusaur → Venusaur-Gmax

export const POKEMON: Record<number, Pokemon> = {
  1: {
    id: 1,
    name: "Bulbasaur",
    type: "grass",
    role: "The Diamond Hand",
    description: "Patient and steadfast. Grows stronger the longer it holds.",
    spriteUrl: SPRITE(1),
    evolutions: [1, 2, 3, 10033, 10185],
  },
  4: {
    id: 4,
    name: "Charmander",
    type: "fire",
    role: "The Degen",
    description: "Burns bright and fast. High risk, high reward trader.",
    spriteUrl: SPRITE(4),
    evolutions: [4, 5, 6, 10034, 10035],
  },
  7: {
    id: 7,
    name: "Squirtle",
    type: "water",
    role: "The Compounder",
    description: "Cool under pressure. Compounds gains steadily over time.",
    spriteUrl: SPRITE(7),
    evolutions: [7, 8, 9, 10036, 10195],
  },
};

export const STARTER_IDS = [1, 4, 7] as const;

export const TYPE_COLOR: Record<PokemonType, string> = {
  fire: "var(--red)",
  water: "var(--blue)",
  grass: "var(--green)",
};

export const TYPE_EMOJI: Record<PokemonType, string> = {
  fire: "🔥",
  water: "💧",
  grass: "🌿",
};

// ─── Deterministic Pokemon assignment from wallet ─────────────────────────────
export function assignPokemon(wallet: string): number {
  const lower = wallet.toLowerCase();
  const sum = lower
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return STARTER_IDS[sum % 3];
}

// ─── Evolution level from token balance ──────────────────────────────────────
export const EVOLUTION_THRESHOLDS = [
  0,         // Lv 1 — any balance
  1_000,     // Lv 2 — 1K tokens
  10_000,    // Lv 3 — 10K tokens
  100_000,   // Lv 4 — 100K tokens
  1_000_000, // Lv 5 — 1M tokens
];

export function getEvolutionLevel(balance: number): number {
  let level = 1;
  for (let i = 1; i < EVOLUTION_THRESHOLDS.length; i++) {
    if (balance >= EVOLUTION_THRESHOLDS[i]) level = i + 1;
  }
  return level;
}

export function getEvolutionProgress(balance: number, level: number): number {
  if (level >= 5) return 100;
  const current = EVOLUTION_THRESHOLDS[level - 1];
  const next = EVOLUTION_THRESHOLDS[level];
  return Math.min(((balance - current) / (next - current)) * 100, 100);
}

export function getPokemonSprite(pokemonId: number, level: number): string {
  const pokemon = POKEMON[pokemonId];
  if (!pokemon) return SPRITE(1);
  const evoId = pokemon.evolutions[Math.min(level - 1, 4)];
  return SPRITE(evoId);
}

// ─── Score calculation ────────────────────────────────────────────────────────
export function calcScore(
  balance: number,
  secondsHeld: number,
  level: number,
  calloutVerified: boolean
): number {
  const multiplier = level * (calloutVerified ? 2 : 1);
  return Math.floor(balance * (secondsHeld / 3600) * multiplier);
}

// ─── Format helpers ───────────────────────────────────────────────────────────
export function fmtBalance(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function fmtSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

export function shortWallet(w: string): string {
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}
