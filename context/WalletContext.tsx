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
  isSigned: boolean;
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
  const [wallet, setWallet]         = useState<string | null>(null);
  const [isSigned, setIsSigned]     = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("pkmn_wallet");
    if (saved) {
      setWallet(saved);
      setIsSigned(true);
    }
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setIsConnecting(true);

    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum) throw new Error("No wallet found. Install MetaMask.");

      const accounts: string[] = await ethereum.request({
        method: "eth_requestAccounts",
      });
      const address = accounts[0].toLowerCase();

      // Switch to Ethereum mainnet (chainId 1 = 0x1)
      try {
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x1" }],
        });
      } catch (switchErr: any) {
        // 0x1 is always available in MetaMask — no need to addEthereumChain
        if (switchErr.code !== 4902) throw switchErr;
      }

      setWallet(address);
      localStorage.setItem("pkmn_wallet", address);

      // SIWE in background
      try {
        const nonceRes = await fetch("/api/auth/nonce");
        const { nonce } = await nonceRes.json();

        const domain  = window.location.host;
        const uri     = window.location.origin;
        const message = [
          `${domain} wants you to sign in with your Ethereum account:`,
          address,
          "",
          "Sign in to $PKMN. Gotta catch em all.",
          "",
          `URI: ${uri}`,
          "Version: 1",
          "Chain ID: 1",
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
        // SIWE optional — wallet still connected
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
      isConnected: !!wallet,
      isConnecting,
      isSigned,
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
