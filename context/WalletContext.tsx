"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

import {
  useWallet,
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import bs58 from "bs58";

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

function WalletInner({ children }: { children: ReactNode }) {
  const {
    publicKey,
    connected,
    connecting,
    signMessage,
    connect: adapterConnect,
    disconnect: adapterDisconnect,
    select,
    wallets,
    wallet: selectedWallet,
  } = useWallet();

  const [isSigned, setIsSigned] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("pkmn_wallet");
    if (saved && publicKey && saved === publicKey.toBase58()) {
      setIsSigned(true);
    }
  }, [publicKey]);

  const connect = useCallback(async () => {
    setError(null);

    try {
      if (!connected) {
        // Find installed wallets (Phantom preferred)
        const installed = wallets.filter(
          (w) => w.readyState === WalletReadyState.Installed
        );
        const target =
          installed.find((w) => w.adapter.name.toLowerCase().includes("phantom")) ??
          installed[0];

        if (!target) {
          window.open("https://phantom.app/", "_blank");
          return;
        }

        // select() triggers the useEffect below which calls adapterConnect()
        select(target.adapter.name);
        return;
      }

      if (!publicKey || !signMessage) {
        throw new Error("Wallet not ready");
      }

      const address = publicKey.toBase58();
      localStorage.setItem("pkmn_wallet", address);

      // SIWS in background
      try {
        const nonceRes = await fetch("/api/auth/nonce");
        const { nonce } = await nonceRes.json();

        const domain  = window.location.host;
        const uri     = window.location.origin;
        const message = [
          `${domain} wants you to sign in with your Solana account:`,
          address,
          "",
          "Sign in to $PKMN on Solana. Gotta catch em all.",
          "",
          `URI: ${uri}`,
          "Version: 1",
          "Chain ID: mainnet-beta",
          `Nonce: ${nonce}`,
          `Issued At: ${new Date().toISOString()}`,
        ].join("\n");

        const msgBytes  = new TextEncoder().encode(message);
        const sigBytes  = await signMessage(msgBytes);
        const signature = bs58.encode(sigBytes);

        const verifyRes = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, signature, publicKey: address }),
        });

        if (verifyRes.ok) {
          setIsSigned(true);
        }
      } catch {
        // user rejected sign — wallet still connected for basic access
      }
    } catch (e: any) {
      setError(e.message ?? "Connection failed");
    }
  }, [connected, publicKey, signMessage, wallets, select]);

  // Once a wallet is selected but not connected → open the popup
  useEffect(() => {
    if (selectedWallet && !connected && !connecting) {
      adapterConnect().catch(() => {});
    }
  }, [selectedWallet, connected, connecting, adapterConnect]);

  // Once connected → run SIWS
  useEffect(() => {
    if (connected && publicKey && !isSigned) {
      connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, publicKey]);

  const disconnect = useCallback(async () => {
    await fetch("/api/auth/verify", { method: "DELETE" }).catch(() => {});
    adapterDisconnect();
    setIsSigned(false);
    localStorage.removeItem("pkmn_wallet");
  }, [adapterDisconnect]);

  return (
    <WalletContext.Provider
      value={{
        wallet: publicKey?.toBase58() ?? null,
        isConnected: !!publicKey,
        isConnecting: connecting,
        isSigned,
        connect,
        disconnect,
        error,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const endpoint =
    process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";

  const adapters = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={adapters} autoConnect={false}>
        <WalletInner>{children}</WalletInner>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}

export function useWalletContext() {
  return useContext(WalletContext);
}

export { useWalletContext as useWallet };
