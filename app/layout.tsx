import type { Metadata } from "next";
import { Press_Start_2P, Inter, JetBrains_Mono } from "next/font/google";
import "@/styles/globals.css";
import { WalletProvider } from "@/context/WalletContext";

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "$PKMN",
  description:
    "The first Pokémon-themed token on Ethereum. Hold $PKMN, evolve your trainer, earn from the vault.",
  openGraph: {
    title: "$PKMN",
    description: "Hold $PKMN on Ethereum. Evolve your Pokémon. Earn ETH.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "$PKMN",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${pressStart.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
