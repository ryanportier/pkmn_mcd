"use client";

import { useMemo } from "react";
import { useDashboard } from "@/hooks/useDashboard";
import { useWallet } from "@/context/WalletContext";
import Nav from "@/components/Nav/Nav";
import PriceBar from "@/components/PriceBar/PriceBar";
import Hero from "@/components/Hero/Hero";
import StarterSelection from "@/components/StarterSelection/StarterSelection";
import VaultCountdown from "@/components/VaultCountdown/VaultCountdown";
import Leaderboard from "@/components/Leaderboard/Leaderboard";
import TrainerAgent from "@/components/TrainerAgent/TrainerAgent";
import PayoutsPanel from "@/components/PayoutsPanel/PayoutsPanel";
import HowItWorks from "@/components/HowItWorks/HowItWorks";
import RegisterTrainer from "@/components/RegisterTrainer/RegisterTrainer";
import Footer from "@/components/Footer/Footer";

const CONTRACT = process.env.NEXT_PUBLIC_PKMN_MINT ?? "";

export default function HomePage() {
  const { data, loading, offline } = useDashboard();
  const { wallet } = useWallet();

  const myHolder = useMemo(() => {
    if (!wallet) return null;
    return data.holders.find(
      (h) => h.wallet.toLowerCase() === wallet.toLowerCase()
    ) ?? null;
  }, [data.holders, wallet]);

  return (
    <>
      <Nav />
      <PriceBar
        priceUsd={data.token_price_usd}
        priceChange24h={data.token_price_change_24h}
        marketCapUsd={data.market_cap_usd}
        volume24hUsd={data.volume_24h_usd}
        contract={CONTRACT}
      />
      <main>
        <Hero
          magicPhrase={data.magic_phrase}
          contract={CONTRACT}
          shiftsCompleted={data.shifts_completed}
        />
        <StarterSelection myHolder={myHolder} />
        <HowItWorks />
        <VaultCountdown
          vault={data.vault}
          holders={data.holders}
          myHolder={myHolder}
          tokenPriceUsd={data.token_price_usd}
          shiftsCompleted={data.shifts_completed}
        />
        <RegisterTrainer magicPhrase={data.magic_phrase} />
        <Leaderboard holders={data.holders} offline={offline} />
        <TrainerAgent />
        <PayoutsPanel payouts={data.recent_payouts} myWallet={wallet} />
      </main>
      <Footer />
    </>
  );
}