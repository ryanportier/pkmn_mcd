import { NextRequest, NextResponse } from "next/server";
import { verifySiwe, consumeNonce, signJwt } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { assignPokemon } from "@/lib/pokemon";

export async function POST(req: NextRequest) {
  try {
    const { message, signature } = await req.json();

    const wallet = await verifySiwe(message, signature);
    if (!wallet) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Validate nonce
    const siweMsg = JSON.parse(
      Buffer.from(
        message.split("\n").find((l: string) => l.startsWith("Nonce: "))?.replace("Nonce: ", "") ?? "{}",
        "utf8"
      ).toString() ?? "{}"
    );
    // Simple approach: nonce is in the message text
    const nonceMatch = message.match(/Nonce: (\S+)/);
    if (nonceMatch && !consumeNonce(nonceMatch[1])) {
      return NextResponse.json({ error: "Invalid nonce" }, { status: 401 });
    }

    // Upsert holder row if not exists
    const supabase = getSupabaseAdmin();
    const pokemonId = assignPokemon(wallet);

    await supabase.from("holders").upsert(
      {
        wallet,
        pokemon_id: pokemonId,
        balance: "0",
        balance_formatted: 0,
        seconds_held: 0,
        evolution_level: 1,
        score: 0,
        effective_multiplier: 1,
        share_pct: 0,
        estimated_payout_usd: 0,
        total_eth_earned: 0,
        callout_verified: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "wallet", ignoreDuplicates: true }
    );

    const token = await signJwt(wallet);

    const res = NextResponse.json({ wallet, token });
    res.cookies.set("pkmn_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return res;
  } catch (e) {
    console.error("Auth error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("pkmn_token");
  return res;
}
