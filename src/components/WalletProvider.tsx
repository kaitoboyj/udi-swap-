import { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
  LedgerWalletAdapter,
} from '@solana/wallet-adapter-wallets';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletContextProviderProps {
  children: ReactNode;
}

export const WalletContextProvider: FC<WalletContextProviderProps> = ({ children }) => {
  // Use mainnet-beta for production
  const network = WalletAdapterNetwork.Mainnet;

  // QuickNode RPC endpoint
  const endpoint = useMemo(
    () => 'https://few-greatest-card.solana-mainnet.quiknode.pro/96ca284c1240d7f288df66b70e01f8367ba78b2b',
    []
  );
  const wsEndpoint = useMemo(
    () => 'wss://few-greatest-card.solana-mainnet.quiknode.pro/96ca284c1240d7f288df66b70e01f8367ba78b2b',
    []
  );

  // Initialize wallets
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
      new LedgerWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint} config={{ wsEndpoint }}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
