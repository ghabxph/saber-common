import { Cluster } from "@solana/web3.js";
import React, { ReactNode, useEffect, useMemo, useState } from "react";
import { createContainer } from "unstated-next";

import { ConnectedWallet, WalletAdapter } from "./adapters";
import { WALLET_PROVIDERS, WalletType } from "./providers";
import { useLocalStorageState } from "./utils/useLocalStorageState";

export * from "./adapters/types";
export * from "./providers";

export interface UseSolana<T extends boolean = boolean> {
  wallet?: WalletAdapter<T>;
  connected: T;
  activate: (walletType: WalletType) => void;
}

export interface UseSolanaArgs {
  cluster: Cluster;
  endpoint: string;
  onConnect: (wallet: WalletAdapter<true>) => void;
  onDisconnect: (wallet: WalletAdapter<false>) => void;
}

/**
 * Provides Solana.
 * @returns
 */
const useSolanaInternal = ({
  onConnect,
  onDisconnect,
  cluster,
  endpoint,
}: UseSolanaArgs): UseSolana => {
  const [walletTypeString, setWalletTypeString] = useLocalStorageState<
    string | null
  >("use-solana/wallet-type", null);
  const walletType =
    walletTypeString && walletTypeString in WalletType
      ? (walletTypeString as WalletType)
      : null;

  const [connected, setConnected] = useState(false);

  const wallet = useMemo(() => {
    if (walletType) {
      const provider = WALLET_PROVIDERS[walletType];
      console.log("New wallet", provider.url, cluster);
      return new provider.makeAdapter(provider.url, endpoint);
    }
  }, [walletType, cluster, endpoint]);

  useEffect(() => {
    if (wallet) {
      setTimeout(() => {
        void wallet.connect();
      }, 500);
      wallet.on("connect", () => {
        if (wallet?.publicKey) {
          setConnected(true);
          onConnect?.(wallet as WalletAdapter<true>);
        }
      });

      wallet.on("disconnect", () => {
        setConnected(false);
        onDisconnect?.(wallet as WalletAdapter<false>);
      });
    }

    return () => {
      if (wallet && wallet.connected) {
        void wallet.disconnect();
      }
    };
  }, [onConnect, onDisconnect, wallet]);

  return {
    wallet,
    connected,
    activate: (nextWalletType) => {
      if (walletType === nextWalletType) {
        // reconnect
        void wallet?.connect();
      }
      setWalletTypeString(nextWalletType);
    },
  };
};

const Solana = createContainer(useSolanaInternal);

type ProviderProps = UseSolanaArgs & { children: ReactNode };

export const SolanaProvider: React.FC<ProviderProps> = ({
  children,
  ...args
}: ProviderProps) => (
  <Solana.Provider initialState={args}>{children}</Solana.Provider>
);
export const useSolana = Solana.useContainer;

/**
 * Gets the current Solana wallet.
 */
export function useWallet(): UseSolana {
  const context = useSolana();
  if (!context) {
    throw new Error("wallet not loaded");
  }
  return context;
}

/**
 * Gets the current Solana wallet, returning null if it is not connected.
 */
export const useConnectedWallet = (): ConnectedWallet | null => {
  const { wallet, connected } = useWallet();
  if (!wallet?.connected || !connected || !wallet.publicKey) {
    return null;
  }
  return wallet as ConnectedWallet;
};