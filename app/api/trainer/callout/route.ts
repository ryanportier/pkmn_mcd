import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { wallet, tweet_url, callout_type } = await req.json();

    if (!wallet || !tweet_url) {
      return NextResponse.json({ error: "wallet and tweet_url required" }, { status: 400 });
    }

    const cleanWallet = wallet.toLowerCase();
    const type = callout_type === "own_post" ? "own_post" : "magic_phrase";

    // Validate tweet URL format
    const isTweetUrl =
      /^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/.test(tweet_url);
    if (!isTweetUrl) {
      return NextResponse.json(
        { error: "Invalid tweet URL. Use format: https://x.com/username/status/123..." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Check trainer is registered
    const { data: profile } = await supabase
      .from("trainer_profiles")
      .select("*")
      .eq("wallet", cleanWallet)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Wallet not registered. Register first." },
        { status: 404 }
      );
    }

    // Don't allow re-submission if already approved
    if (profile.callout_status === "approved") {
      return NextResponse.json(
        {
          error: "Already approved",
          message: `Your callout is already approved with ×${profile.callout_multiplier} bonus!`,
        },
        { status: 400 }
      );
    }

    // Update callout submission
    await supabase
      .from("trainer_profiles")
      .update({
        callout_type: type,
        callout_tweet_url: tweet_url,
        callout_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("wallet", cleanWallet);

    return NextResponse.json({
      success: true,
      message:
        "Tweet submitted! Professor Oak is reviewing it. You'll get your bonus once approved (usually within 24h).",
      callout_type: type,
      expected_multiplier: type === "own_post" ? 4 : 2,
    });
  } catch (e: any) {
    console.error("Callout error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// GET — check callout status for a wallet
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.toLowerCase();
  if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("trainer_profiles")
    .select("callout_status, callout_multiplier, callout_type, twitter_handle")
    .eq("wallet", wallet)
    .single();

  return NextResponse.json(data ?? { callout_status: "none" });
}
