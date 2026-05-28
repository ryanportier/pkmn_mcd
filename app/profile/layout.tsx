import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trainer Profile — $PKMN",
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
