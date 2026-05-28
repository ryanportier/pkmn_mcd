"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

interface WalletContextValue {
  wallet: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isSigned: boolean;         // true solo si completó SIWE
  connect: () => Promise<void>;
  disconnect: () => void;
  error: string | null;
}

const WalletContext = createContext<WalletContextValue>({
  wallet: null,
  isConnected: false,
  isConnecting: false,
  isSigned: false,
  connect: async () => {},
  disconnect: () => {},
  error: null,
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<string | null>(null);
  const [isSigned, setIsSigned] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore wallet from localStorage on mount — NO automatic popup
  useEffect(() => {
    const saved = localStorage.getItem("pkmn_wallet");
    if (saved) {
      setWallet(saved);
      setIsSigned(true);
    }
    // Removed: eth_accounts check — that was triggering Phantom/MetaMask popup
    // Users must explicitly click CONNECT
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setIsConnecting(true);

    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        throw new Error("No wallet found. Install MetaMask.");
      }

      // Step 1 — Request accounts (shows MetaMask popup)
      const accounts: string[] = await ethereum.request({
        method: "eth_requestAccounts",
      });
      const address = accounts[0].toLowerCase();

      // Step 2 — Switch to Base chain
      try {
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });
      } catch (switchErr: any) {
        if (switchErr.code === 4902) {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x2105",
              chainName: "Base",
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://mainnet.base.org"],
              blockExplorerUrls: ["https://basescan.org"],
            }],
          });
        }
      }

      // Step 3 — Set wallet immediately so Oak can work right away
      setWallet(address);
      localStorage.setItem("pkmn_wallet", address); // save immediately, no SIWE needed

      // Step 4 — Try SIWE in background (optional, for protected routes)
      try {
        const nonceRes = await fetch("/api/auth/nonce");
        const { nonce } = await nonceRes.json();

        const domain = window.location.host;
        const uri = window.location.origin;
        const message = [
          `${domain} wants you to sign in with your Ethereum account:`,
          address,
          "",
          "Sign in to $PKMN on Base. Gotta catch em all.",
          "",
          `URI: ${uri}`,
          "Version: 1",
          "Chain ID: 8453",
          `Nonce: ${nonce}`,
          `Issued At: ${new Date().toISOString()}`,
        ].join("\n");

        const signature = await ethereum.request({
          method: "personal_sign",
          params: [message, address],
        });

        const verifyRes = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, signature }),
        });

        if (verifyRes.ok) {
          setIsSigned(true);
          localStorage.setItem("pkmn_wallet", address);
        }
      } catch {
        // SIWE failed or user rejected — wallet still connected for Oak
        // isSigned stays false but wallet is set
      }

    } catch (e: any) {
      setError(e.message ?? "Connection failed");
      setWallet(null);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await fetch("/api/auth/verify", { method: "DELETE" }).catch(() => {});
    setWallet(null);
    setIsSigned(false);
    localStorage.removeItem("pkmn_wallet");
  }, []);

  return (
    <WalletContext.Provider value={{
      wallet,
      isConnected: !!wallet,   // true apenas conecta MetaMask
      isConnecting,
      isSigned,                // true solo si firmó SIWE
      connect,
      disconnect,
      error,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}