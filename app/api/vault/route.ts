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

  // If expired → settle + create new round automatically
  if (round && new Date(round.ends_at) < new Date()) {
    await supabase
      .from("vault_rounds")
      .update({ status: "settled", shifts_completed: (round.shifts_completed ?? 0) + 1 })
      .eq("id", round.id);

    const prevUsd = Number(round.total_usd ?? 0);
    const prevEth = Number(round.total_eth ?? 0);

    const startsAt = new Date();
    const endsAt   = new Date(startsAt.getTime() + ROUND_DURATION);
    const { data: newRound } = await supabase
      .from("vault_rounds")
      .insert({
        starts_at: startsAt.toISOString(),
        ends_at:   endsAt.toISOString(),
        total_eth: prevEth,
        total_usd: prevUsd,
        status: "active",
        shifts_completed: 0,
      })
      .select()
      .single();

    round = newRound;
  }

  // No active round → create first one
  if (!round) {
    const startsAt = new Date();
    const endsAt   = new Date(startsAt.getTime() + ROUND_DURATION);
    const { data: newRound } = await supabase
      .from("vault_rounds")
      .insert({
        starts_at: startsAt.toISOString(),
        ends_at:   endsAt.toISOString(),
        total_eth: 0,
        total_usd: 0,
        status: "active",
        shifts_completed: 0,
      })
      .select()
      .single();
    round = newRound;
  }

  const priceData = await getTokenPrice(
    process.env.NEXT_PUBLIC_PKMN_CONTRACT!
  );

  return NextResponse.json({ round, price: priceData });
}
