import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getTokenPrice } from "@/lib/dexscreener";

const ROUND_DURATION =
  parseInt(process.env.VAULT_ROUND_DURATION_SECONDS ?? "3600") * 1000;

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Check for active round
  let { data: round } = await supabase
    .from("vault_rounds")
    .select("*")
    .eq("status", "active")
    .order("id", { ascending: false })
    .limit(1)
    .single();

  // If no active round, create one
  if (!round) {
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + ROUND_DURATION);
    const { data: newRound } = await supabase
      .from("vault_rounds")
      .insert({
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        total_eth: 0,
        total_usd: 0,
        status: "active",
        shifts_completed: 0,
      })
      .select()
      .single();
    round = newRound;
  }

  // Check if round expired → settle it
  if (round && new Date(round.ends_at) < new Date()) {
    await supabase
      .from("vault_rounds")
      .update({ status: "settling" })
      .eq("id", round.id);

    // Trigger settlement (async, fire and forget in real impl)
    // In production, use a Supabase Edge Function or cron job
    round.status = "settling";
  }

  const priceData = await getTokenPrice(
    process.env.NEXT_PUBLIC_PKMN_CONTRACT!
  );

  return NextResponse.json({ round, price: priceData });
}
