// ─── Pokemon ──────────────────────────────────────────────────────────────────
export type PokemonType = "fire" | "water" | "grass";

export interface Pokemon {
  id: number;
  name: string;
  type: PokemonType;
  role: string;
  description: string;
  spriteUrl: string;
  evolutions: number[]; // sprite IDs for each level (1-5)
}

// ─── Holder / Trainer ─────────────────────────────────────────────────────────
export interface Holder {
  wallet: string;
  balance: string;         // raw token amount as string
  balance_formatted: number;
  seconds_held: number;
  pokemon_id: number;
  evolution_level: number; // 1-5
  score: number;
  effective_multiplier: number;
  share_pct: number;
  estimated_payout_usd: number;
  total_sol_earned: number;
  callout_verified: boolean;
  updated_at: string;
}

// ─── Vault Round ──────────────────────────────────────────────────────────────
export interface VaultRound {
  id: number;
  starts_at: string;
  ends_at: string;
  total_sol: number;
  total_usd: number;
  status: "active" | "settling" | "settled";
  shifts_completed: number;
}

// ─── Payout ───────────────────────────────────────────────────────────────────
export interface Payout {
  id: number;
  wallet: string;
  round_id: number;
  share_pct: number;
  amount_sol: number;
  amount_usd: number;
  won_at: string;
}

// ─── API Responses ────────────────────────────────────────────────────────────
export interface DashboardData {
  vault: VaultRound | null;
  holders: Holder[];
  recent_payouts: Payout[];
  token_price_usd: number;
  token_price_change_24h: number;
  market_cap_usd: number;
  volume_24h_usd: number;
  magic_phrase: string;
  shifts_completed: number;
}

export interface TrainerData {
  holder: Holder | null;
  pokemon: Pokemon | null;
  rank: number | null;
  payouts: Payout[];
}

// ─── Agent / Trainer Agent ────────────────────────────────────────────────────
export interface AgentMessage {
  role: "oak" | "trainer";
  content: string;
  timestamp: string;
  tool_used?: string;
  tool_result?: Record<string, unknown>;
}

export interface AgentStrategy {
  id: string;
  wallet: string;
  rules: StrategyRule[];
  active: boolean;
  created_at: string;
}

export interface StrategyRule {
  type: "min_level" | "top_rank" | "auto_claim" | "alert_payout";
  params: Record<string, unknown>;
  description: string;
}

export interface AgentToolResult {
  tool: string;
  data: Record<string, unknown>;
  success: boolean;
  error?: string;
}
export interface AgentMessage {
  role: "oak" | "trainer";
  content: string;
  timestamp: string;
  tool_used?: string;
  tool_result?: Record<string, unknown>;
}

export interface AgentStrategy {
  id: string;
  wallet: string;
  rules: StrategyRule[];
  active: boolean;
  created_at: string;
}

export interface StrategyRule {
  type: "min_level" | "top_rank" | "auto_claim" | "alert_payout";
  params: Record<string, unknown>;
  description: string;
}

export interface AgentToolResult {
  tool: string;
  data: Record<string, unknown>;
  success: boolean;
  error?: string;
}
