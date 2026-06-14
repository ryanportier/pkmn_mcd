import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { POKEMON, assignPokemon } from "@/lib/pokemon";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const [holderRes, payoutsRes] = await Promise.all([
    supabase.from("holders").select("*").eq("wallet", wallet).single(),
    supabase
      .from("payouts")
      .select("*")
      .eq("wallet", wallet)
      .order("won_at", { ascending: false })
      .limit(20),
  ]);

  const holder    = holderRes.data;
  const pokemonId = holder?.pokemon_id ?? assignPokemon(wallet);
  const pokemon   = POKEMON[pokemonId] ?? null;

  // Compute rank
  let rank: number | null = null;
  if (holder) {
    const { count } = await supabase
      .from("holders")
      .select("*", { count: "exact", head: true })
      .gt("score", holder.score ?? 0);
    rank = (count ?? 0) + 1;
  }

  return NextResponse.json({
    holder: holder ?? null,
    pokemon,
    rank,
    payouts: payoutsRes.data ?? [],
  });
}