import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletName, WalletReadyState } from '@solana/wallet-adapter-base';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export const CustomWalletModal: React.FC = () => {
  const { wallets, select } = useWallet();
  const { visible, setVisible } = useWalletModal();

  const handleWalletClick = (walletName: WalletName) => {
    select(walletName);
    setVisible(false);
  };

  return (
    <Dialog open={visible} onOpenChange={setVisible}>
      <DialogContent className="sm:max-w-md">
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-xl font-bold">Connect Wallet</h2>
            <p className="text-sm text-muted-foreground">
              Choose a wallet to connect to this dapp
            </p>
          </div>
          
          <div className="grid gap-3">
            {wallets
              .filter((wallet) => wallet.readyState !== WalletReadyState.Unsupported)
              .map((wallet) => (
                <Button
                  key={wallet.adapter.name}
                  variant="outline"
                  className="flex items-center justify-between w-full p-4 h-auto"
                  onClick={() => handleWalletClick(wallet.adapter.name)}
                >
                  <div className="flex items-center gap-3">
                    {wallet.adapter.icon && (
                      <img 
                        src={wallet.adapter.icon} 
                        alt={`${wallet.adapter.name} icon`}
                        className="w-8 h-8"
                      />
                    )}
                    <div className="text-left">
                      <div className="font-medium">{wallet.adapter.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {wallet.readyState === WalletReadyState.Installed
                          ? 'Detected'
                          : wallet.readyState === WalletReadyState.Loadable
                          ? 'Available for install'
                          : 'Not installed'}
                      </div>
                    </div>
                  </div>
                </Button>
              ))}
          </div>
          
          <div className="text-center text-xs text-muted-foreground">
            <p>By connecting a wallet, you agree to our Terms of Service and Privacy Policy</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};