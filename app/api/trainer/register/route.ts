import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getWalletTokenBalance } from "@/lib/alchemy";
import { assignPokemon, POKEMON, getEvolutionLevel, getEvolutionName } from "@/lib/pokemon";

const CONTRACT = process.env.NEXT_PUBLIC_PKMN_CONTRACT!;
const DECIMALS = 18;

export async function POST(req: NextRequest) {
  try {
    const { wallet, twitter_handle } = await req.json();

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    const cleanWallet  = wallet.toLowerCase();
    const cleanTwitter = twitter_handle
      ? twitter_handle.replace(/^@/, "").toLowerCase().trim()
      : null;

    // ── 1. Verify holder via Alchemy ─────────────────────────────────────────
    const rawBalance = await getWalletTokenBalance(cleanWallet, CONTRACT);
    const balance    = Number(BigInt(rawBalance)) / Math.pow(10, DECIMALS);

    if (balance <= 0) {
      return NextResponse.json(
        {
          error: "No $PKMN balance found",
          message: "This wallet doesn't hold any $PKMN tokens on Base. Buy some first!",
        },
        { status: 400 }
      );
    }

    const supabase  = getSupabaseAdmin();
    const pokemonId = assignPokemon(cleanWallet);
    const pk        = POKEMON[pokemonId];
    const level     = getEvolutionLevel(balance);

    // ── 2. Upsert holder row (in case sync hasn't run yet) ───────────────────
    await supabase.from("holders").upsert(
      {
        wallet: cleanWallet,
        balance: rawBalance,
        balance_formatted: balance,
        pokemon_id: pokemonId,
        evolution_level: level,
        seconds_held: 0,
        score: 0,
        effective_multiplier: level,
        share_pct: 0,
        estimated_payout_usd: 0,
        total_eth_earned: 0,
        callout_verified: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "wallet", ignoreDuplicates: true }
    );

    // ── 3. Upsert trainer profile ────────────────────────────────────────────
    const { data: existing } = await supabase
      .from("trainer_profiles")
      .select("*")
      .eq("wallet", cleanWallet)
      .single();

    if (existing) {
      // Already registered — update twitter if provided
      if (cleanTwitter && cleanTwitter !== existing.twitter_handle) {
        await supabase
          .from("trainer_profiles")
          .update({ twitter_handle: cleanTwitter, updated_at: new Date().toISOString() })
          .eq("wallet", cleanWallet);
      }
      return NextResponse.json({
        success: true,
        already_registered: true,
        wallet: cleanWallet,
        pokemon: getEvolutionName(pokemonId, level),
        level,
        balance,
        twitter_handle: cleanTwitter ?? existing.twitter_handle,
        callout_status: existing.callout_status,
        callout_multiplier: existing.callout_multiplier,
      });
    }

    await supabase.from("trainer_profiles").insert({
      wallet: cleanWallet,
      twitter_handle: cleanTwitter,
      callout_status: "none",
      callout_multiplier: 1,
      registered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      already_registered: false,
      wallet: cleanWallet,
      pokemon: getEvolutionName(pokemonId, level),
      level,
      balance,
      twitter_handle: cleanTwitter,
      callout_status: "none",
      callout_multiplier: 1,
    });
  } catch (e: any) {
    console.error("Register error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
