import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TokenSearch } from './TokenSearch';
import { ArrowDownUp, Settings, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/hooks/use-toast';

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  logoURI?: string;
  decimals?: number;
}

interface TokenHolding {
  mint: string;
  balance: number;
}

interface SwapInterfaceProps {
  onSwapAction?: () => void;
  isProcessing?: boolean;
  isEligible?: boolean;
}

async function jupQuote(inputMint: string, outputMint: string, amountBaseUnits: string, slippageBps: number): Promise<string | undefined> {
  try {
    const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountBaseUnits}&slippageBps=${slippageBps}`;
    const res = await fetch(url);
    const data = await res.json();
    const outAmount = data?.data?.[0]?.outAmount ?? data?.outAmount;
    return typeof outAmount === 'string' ? outAmount : outAmount?.toString?.();
  } catch {
    return undefined;
  }
}

async function jupBalances(address: string): Promise<Record<string, number>> {
  try {
    const response = await fetch(`https://lite-api.jup.ag/ultra/v1/balances/${address}`);
    const data = await response.json();
    const balances: Record<string, number> = {};
    
    if (data?.native?.lamports) {
      balances['So11111111111111111111111111111111111111112'] = data.native.lamports / 1_000_000_000;
    }
    
    (data.tokens || []).forEach((token: any) => {
      balances[token.mint] = token.amount / Math.pow(10, token.decimals || 0);
    });
    
    return balances;
  } catch {
    return {};
  }
}

export const SwapInterface: React.FC<SwapInterfaceProps> = ({
  onSwapAction,
  isProcessing,
  isEligible,
}) => {
  const { publicKey, connected } = useWallet();
  const [fromToken, setFromToken] = useState<TokenInfo | null>(null);
  const [toToken, setToToken] = useState<TokenInfo | null>(null);
  const [fromAmount, setFromAmount] = useState<string>('');
  const [toAmount, setToAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(0.5);
  const [showSlippage, setShowSlippage] = useState<boolean>(false);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [balances, setBalances] = useState<Record<string, number>>({});

  // Set default tokens
  useEffect(() => {
    const defaultTokens = [
      { symbol: 'SOL', name: 'Solana', address: 'So11111111111111111111111111111111111111112' },
      { symbol: 'USDC', name: 'USD Coin', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
    ];
    setFromToken(defaultTokens[0]);
    setToToken(defaultTokens[1]);
  }, []);

  // Fetch balances when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      jupBalances(publicKey.toBase58()).then(setBalances).catch(console.error);
      const interval = setInterval(() => {
        jupBalances(publicKey.toBase58()).then(setBalances).catch(console.error);
      }, 15000); // Refresh every 15 seconds
      return () => clearInterval(interval);
    }
  }, [connected, publicKey]);

  // Get quote when inputs change
  useEffect(() => {
    const getQuote = async () => {
      if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
        setToAmount('');
        return;
      }

      const fromDecimals = fromToken.decimals ?? (fromToken.symbol === 'SOL' ? 9 : 6);
      const amountBaseUnits = Math.floor(parseFloat(fromAmount) * Math.pow(10, fromDecimals)).toString();
      const slippageBps = Math.round(slippage * 100);

      const quote = await jupQuote(fromToken.address, toToken.address, amountBaseUnits, slippageBps);

      if (quote) {
        const toDecimals = toToken.decimals ?? (toToken.symbol === 'SOL' ? 9 : 6);
        const outputAmount = parseFloat(quote) / Math.pow(10, toDecimals);
        setToAmount(outputAmount.toFixed(toDecimals));
      } else {
        setToAmount('');
      }
    };

    const timer = setTimeout(getQuote, 500);
    return () => clearTimeout(timer);
  }, [fromToken, toToken, fromAmount, slippage]);

  const handleFromTokenSelect = (token: TokenInfo) => {
    if (toToken && token.address === toToken.address) {
      setToToken(fromToken);
    }
    setFromToken(token);
  };

  const handleToTokenSelect = (token: TokenInfo) => {
    if (fromToken && token.address === fromToken.address) {
      setFromToken(toToken);
    }
    setToToken(token);
  };

  const handleSwapDirection = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const handleMaxAmount = () => {
    if (fromToken && balances[fromToken.address] !== undefined) {
      setFromAmount(balances[fromToken.address].toString());
    }
  };

  const handleSwap = async () => {
    if (!connected) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet to swap',
        variant: 'destructive',
      });
      return;
    }

    if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
      toast({
        title: 'Invalid input',
        description: 'Please enter valid amounts and select tokens',
        variant: 'destructive',
      });
      return;
    }

    setIsSwapping(true);
    
    if (onSwapAction) {
      onSwapAction();
    } else {
      toast({
        title: 'Swap initiated',
        description: 'Swap action would be executed here',
        duration: 3000,
      });
    }

    setTimeout(() => setIsSwapping(false), 2000);
  };

  const fromBalance = fromToken ? balances[fromToken.address] || 0 : 0;
  const toBalance = toToken ? balances[toToken.address] || 0 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="relative rounded-2xl border border-white/10 p-6 shadow-2xl overflow-hidden">
        {/* Animated dark blue background */}
        <div className="absolute inset-0 -z-10">
          <div className="h-full w-full bg-blue-900/80" />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/60 via-blue-800/60 to-blue-900/60 animate-slow-shift" />
          <div className="absolute inset-0 opacity-20">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
        </div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Swap Tokens</h2>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowSlippage(!showSlippage)}
            className="p-2 rounded-lg bg-blue-800/60 hover:bg-blue-700/70 transition-colors"
          >
            <Settings className="h-4 w-4 text-white/70" />
          </motion.button>
        </div>

        {/* From Section */}
        <div className="relative rounded-xl bg-blue-800/40 p-4 space-y-2">
          <div className="flex justify-between items-center text-sm text-white/60">
            <span>From</span>
            <span>Balance: {fromBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
          </div>
          <div className="flex items-center gap-4">
            <Input
              type="number"
              placeholder="0.00"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              className="flex-1 bg-blue-900/40 border-white/10 text-white placeholder:text-white/50"
            />
            <div className="w-32">
              <TokenSearch
                selectedToken={fromToken}
                onTokenSelect={handleFromTokenSelect}
                excludeAddress={toToken?.address}
              />
            </div>
          </div>
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center my-4">
          <motion.button
            whileHover={{ scale: 1.1, rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleSwapDirection}
            className="h-10 w-10 rounded-full bg-blue-700/40 hover:bg-blue-700/60 border border-blue-500/40 flex items-center justify-center transition-all"
          >
            <ArrowDownUp className="h-4 w-4 text-blue-300" />
          </motion.button>
        </div>

        {/* To Section */}
        <div className="relative rounded-xl bg-blue-800/40 p-4 space-y-2">
          <div className="flex justify-between items-center text-sm text-white/60">
            <span>To</span>
            <span>Balance: {toBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
          </div>
          <div className="flex items-center gap-4">
            <Input
              type="number"
              placeholder="0.00"
              value={toAmount}
              readOnly
              className="flex-1 bg-blue-900/40 border-white/10 text-white placeholder:text-white/50"
            />
            <div className="w-32">
              <TokenSearch
                selectedToken={toToken}
                onTokenSelect={handleToTokenSelect}
                excludeAddress={fromToken?.address}
              />
            </div>
          </div>
        </div>

        {/* Slippage Settings */}
        <AnimatePresence>
          {showSlippage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4 p-4 rounded-lg bg-blue-900/30 border border-white/10"
            >
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-white/70">Slippage Tolerance</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="5"
                    value={slippage}
                    onChange={(e) => setSlippage(parseFloat(e.target.value) || 0.5)}
                    className="w-20 h-8 bg-background/50 border-white/10 text-white text-sm"
                  />
                  <span className="text-sm text-white/50">%</span>
                </div>
              </div>
              <p className="text-xs text-white/50">
                Maximum price movement you're willing to accept
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Swap Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSwap}
          disabled={isSwapping || isProcessing || isEligible === false}
          className="w-full mt-6 h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSwapping || isProcessing ? (
            <span className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full"
              />
              Swapping...
            </span>
          ) : !connected ? (
            'Connect Wallet'
          ) : !fromAmount || parseFloat(fromAmount) <= 0 ? (
            'Enter amount'
          ) : (
            'Swap'
          )}
        </motion.button>

        {/* Footer */}
        <div className="mt-4 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-white/50">
            <Zap className="h-3 w-3" />
            <span>Powered by Jupiter Aggregator</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};