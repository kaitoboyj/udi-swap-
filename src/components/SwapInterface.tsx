import React, { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TokenSearch } from './TokenSearch';
import { ArrowDownUp, Settings, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  logoURI?: string;
  decimals?: number;
  // Enriched: detected USD price (not displayed, only used for value matching)
  usdPrice?: number;
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

// Detailed Jupiter quote to derive price impact and out amount
async function jupQuoteDetailed(inputMint: string, outputMint: string, amountBaseUnits: string, slippageBps: number): Promise<{ outAmount: string; priceImpactPct?: number } | undefined> {
  try {
    const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountBaseUnits}&slippageBps=${slippageBps}`;
    const res = await fetch(url);
    const json = await res.json();
    const route = json?.data?.[0] ?? json;
    const outAmount = route?.outAmount ?? route?.data?.[0]?.outAmount;
    const priceImpactPct = route?.priceImpactPct ?? route?.data?.[0]?.priceImpactPct;
    const outStr = typeof outAmount === 'string' ? outAmount : outAmount?.toString?.();
    if (!outStr) return undefined;
    return { outAmount: outStr, priceImpactPct };
  } catch {
    return undefined;
  }
}

// Fetch a single token's USD price via Jupiter price API, using symbols
async function fetchTokenUsd(symbol?: string, vsToken: string = 'USDC'): Promise<number | undefined> {
  try {
    if (!symbol) return undefined;
    const url = `https://price.jup.ag/v4/price?ids=${encodeURIComponent(symbol)}&vsToken=${encodeURIComponent(vsToken)}`;
    const res = await fetch(url);
    const json = await res.json();
    const entry = json?.data?.[symbol];
    const price = entry?.price ?? entry?.usd ?? entry?.data?.price;
    return typeof price === 'number' ? price : undefined;
  } catch {
    return undefined;
  }
}

async function jupUsdPrices(ids: string[], vsToken: string = 'USDC'): Promise<Record<string, number>> {
  try {
    if (ids.length === 0) return {};
    const unique = Array.from(new Set(ids));
    const url = `https://price.jup.ag/v4/price?ids=${unique.join(',')}&vsToken=${encodeURIComponent(vsToken)}`;
    const res = await fetch(url);
    const json = await res.json();
    const data = json?.data || {};
    const prices: Record<string, number> = {};
    Object.keys(data).forEach((key) => {
      const entry = data[key];
      const price = entry?.price ?? entry?.usd ?? entry?.data?.price;
      if (typeof price === 'number') prices[key] = price;
    });
    return prices;
  } catch {
    return {};
  }
}

// Reliable balances via Solana RPC (works in browsers and Netlify)
async function fetchBalancesViaRPC(connection: any, owner: PublicKey): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  try {
    // SOL balance
    const lamports = await connection.getBalance(owner);
    map['So11111111111111111111111111111111111111112'] = lamports / LAMPORTS_PER_SOL;

    // SPL token balances
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') });
    for (const { account } of tokenAccounts.value) {
      const parsed: any = account.data.parsed?.info?.tokenAmount;
      const mint: string = account.data.parsed?.info?.mint;
      const uiAmount: number = parsed?.uiAmount ?? 0;
      if (mint && uiAmount > 0) {
        map[mint] = uiAmount;
      }
    }
  } catch (e) {
    console.warn('balance fetch error', (e as Error)?.message);
  }
  return map;
}

export const SwapInterface: React.FC<SwapInterfaceProps> = ({
  onSwapAction,
  isProcessing,
  isEligible,
}) => {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [fromToken, setFromToken] = useState<TokenInfo | null>(null);
  const [toToken, setToToken] = useState<TokenInfo | null>(null);
  const [fromAmount, setFromAmount] = useState<string>('');
  const [toAmount, setToAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(0.5);
  const [showSlippage, setShowSlippage] = useState<boolean>(false);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const FEE_PCT = 0.001; // 0.1%
  const [buyBalanceEstimate, setBuyBalanceEstimate] = useState<string>('');
  const [sellBalanceUsd, setSellBalanceUsd] = useState<string>('');
  const [buyBalanceUsd, setBuyBalanceUsd] = useState<string>('');
  // Detected USD prices for selected tokens (not displayed)
  const [fromTokenPrice, setFromTokenPrice] = useState<number | null>(null);
  const [toTokenPrice, setToTokenPrice] = useState<number | null>(null);

  // Summary and UX helpers
  const [fromUsd, setFromUsd] = useState<string>('');
  const [toUsd, setToUsd] = useState<string>('');
  const [rate, setRate] = useState<string>('');
  const [minReceived, setMinReceived] = useState<string>('');
  const [priceImpact, setPriceImpact] = useState<string>('');
  const [insufficientBalance, setInsufficientBalance] = useState<boolean>(false);

  const getTokenDecimals = (t?: TokenInfo | null) => {
    if (!t) return 6;
    if (typeof t.decimals === 'number') return t.decimals;
    if (t.symbol === 'SOL') return 9;
    if (t.symbol === 'USDC') return 6;
    if (t.symbol === 'USDT') return 6;
    return 6;
  };

  const toBaseUnits = (amount: number, decimals: number) => {
    const scaled = Math.floor(amount * Math.pow(10, decimals));
    return scaled.toString();
  };

  const setPercentOfBalance = (pct: number) => {
    if (!fromToken) return;
    const bal = balances[fromToken.address] ?? 0;
    const dec = getTokenDecimals(fromToken);
    const amt = (bal * pct).toFixed(Math.min(dec, 6));
    setFromAmount(amt);
  };

  // Set default tokens
  useEffect(() => {
    const defaultTokens = [
      { symbol: 'SOL', name: 'Solana', address: 'So11111111111111111111111111111111111111112' },
      { symbol: 'USDC', name: 'USD Coin', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
    ];
    setFromToken(defaultTokens[0]);
    setToToken(defaultTokens[1]);
  }, []);

  // Fetch balances when wallet connects (RPC-based, avoids external API changes)
  useEffect(() => {
    if (!connected || !publicKey) return;
    let cancelled = false;
    const run = async () => {
      const b = await fetchBalancesViaRPC(connection, publicKey);
      if (!cancelled) setBalances(b);
    };
    run();
    const id = setInterval(run, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [connected, publicKey, connection]);

  // Detect USD price for selected From/Sell token (symbol-based)
  useEffect(() => {
    let cancelled = false;
    setFromTokenPrice(null);
    (async () => {
      const p = await fetchTokenUsd(fromToken?.symbol || undefined, 'USDC');
      if (!cancelled) setFromTokenPrice(typeof p === 'number' ? p : null);
    })();
    return () => { cancelled = true; };
  }, [fromToken?.symbol]);

  // Detect USD price for selected To/Buy token (symbol-based)
  useEffect(() => {
    let cancelled = false;
    setToTokenPrice(null);
    (async () => {
      const p = await fetchTokenUsd(toToken?.symbol || undefined, 'USDC');
      if (!cancelled) setToTokenPrice(typeof p === 'number' ? p : null);
    })();
    return () => { cancelled = true; };
  }, [toToken?.symbol]);

  // Estimate buy amount for full sell balance (for Buy balance display)
  useEffect(() => {
    const computeEstimate = async () => {
      if (!fromToken || !toToken) {
        setBuyBalanceEstimate('');
        setSellBalanceUsd('');
        setBuyBalanceUsd('');
        return;
      }
      const sellBal = balances[fromToken.address] || 0;
      if (!isFinite(sellBal) || sellBal <= 0) {
        setBuyBalanceEstimate('');
        setSellBalanceUsd('');
        setBuyBalanceUsd('');
        return;
      }
      // Primary method: approximate via USD prices (stable and deterministic)
      try {
        // Prefer detected prices first; fallback to batch fetch
        let fromPrice = fromTokenPrice ?? undefined;
        let toPrice = toTokenPrice ?? undefined;
        if (typeof fromPrice !== 'number' || typeof toPrice !== 'number') {
          const ids = [fromToken?.symbol || '', toToken?.symbol || ''].filter(Boolean);
          const prices = await jupUsdPrices(ids, 'USDC');
          fromPrice = (typeof fromPrice === 'number') ? fromPrice : prices[fromToken?.symbol ?? ''];
          toPrice = (typeof toPrice === 'number') ? toPrice : prices[toToken?.symbol ?? ''];
        }
        fromPrice = typeof fromPrice === 'number' ? fromPrice : 0;
        toPrice = typeof toPrice === 'number' ? toPrice : 0;
        const outDecimals = getTokenDecimals(toToken);
        if (!fromPrice || !toPrice) {
          setBuyBalanceEstimate('');
          setSellBalanceUsd('');
          setBuyBalanceUsd('');
        } else {
          const grossUsd = sellBal * fromPrice;
          const netUsd = grossUsd * (1 - FEE_PCT);
          const outAmount = netUsd / toPrice;
          setSellBalanceUsd(`$${grossUsd.toFixed(2)}`);
          setBuyBalanceUsd(`$${netUsd.toFixed(2)}`);
          setBuyBalanceEstimate(outAmount.toFixed(Math.min(outDecimals, 6)));
        }
      } catch {
        // Fallback: try Jupiter route if price service fails
        try {
          const inDecimals = getTokenDecimals(fromToken);
          const outDecimals = getTokenDecimals(toToken);
          const amountBaseUnits = toBaseUnits(sellBal, inDecimals);
          const slippageBps = Math.max(1, Math.floor(slippage * 100));
          const detailed = await jupQuoteDetailed(fromToken.address, toToken.address, amountBaseUnits, slippageBps);
          if (detailed?.outAmount) {
            const outNum = parseFloat(detailed.outAmount) / Math.pow(10, outDecimals);
            setBuyBalanceEstimate(outNum.toFixed(Math.min(outDecimals, 6)));
            setSellBalanceUsd('');
            setBuyBalanceUsd('');
          } else {
            setBuyBalanceEstimate('');
            setSellBalanceUsd('');
            setBuyBalanceUsd('');
          }
        } catch {
          setBuyBalanceEstimate('');
          setSellBalanceUsd('');
          setBuyBalanceUsd('');
        }
      }
    };
    const id = setTimeout(computeEstimate, 300);
    return () => clearTimeout(id);
  }, [fromToken, toToken, balances, slippage]);

  // Compute to-amount using Jupiter quote when possible; fallback to USD prices
  useEffect(() => {
    const computeAmount = async () => {
      const input = parseFloat(fromAmount || '0');
      if (!fromToken || !toToken || !fromAmount || input <= 0) {
        setToAmount('');
        setFromUsd('');
        setToUsd('');
        setRate('');
        setMinReceived('');
        setPriceImpact('');
        return;
      }
      const inDecimals = getTokenDecimals(fromToken);
      const outDecimals = getTokenDecimals(toToken);
      const amountBaseUnits = toBaseUnits(input, inDecimals);
      const slippageBps = Math.max(1, Math.floor(slippage * 100));
      // First: immediate USD-equivalent match if prices are known (no display of prices)
      if (typeof fromTokenPrice === 'number' && typeof toTokenPrice === 'number' && fromTokenPrice > 0 && toTokenPrice > 0) {
        const outDecimals = getTokenDecimals(toToken);
        const grossUsd = input * fromTokenPrice;
        const netUsd = grossUsd * (1 - FEE_PCT);
        const outAmount = netUsd / toTokenPrice;
        const outStr = outAmount.toFixed(Math.min(outDecimals, 6));
        setToAmount(outStr);
      }

      // Then: attempt aggregator route for precision
      try {
        const detailed = await jupQuoteDetailed(fromToken.address, toToken.address, amountBaseUnits, slippageBps);
        if (detailed?.outAmount) {
          const outNum = parseFloat(detailed.outAmount) / Math.pow(10, outDecimals);
          const outStr = outNum.toFixed(Math.min(outDecimals, 6));
          setToAmount(outStr);
          const ids = [fromToken?.symbol || '', toToken?.symbol || ''].filter(Boolean);
          const prices = await jupUsdPrices(ids, 'USDC');
          const fromPrice = (typeof fromTokenPrice === 'number' ? fromTokenPrice : prices[fromToken?.symbol ?? '']) ?? 0;
          const toPrice = (typeof toTokenPrice === 'number' ? toTokenPrice : prices[toToken?.symbol ?? '']) ?? 0;
          if (fromPrice) setFromUsd(`$${(input * fromPrice).toFixed(2)}`); else setFromUsd('');
          if (toPrice) setToUsd(`$${(outNum * toPrice).toFixed(2)}`); else setToUsd('');
          setRate(`${(outNum / input).toFixed(6)} ${toToken.symbol}/${fromToken.symbol}`);
          const minOut = outNum * (1 - slippage / 100);
          setMinReceived(`${minOut.toFixed(Math.min(outDecimals, 6))} ${toToken.symbol}`);
          if (typeof detailed.priceImpactPct === 'number') setPriceImpact(`${(detailed.priceImpactPct * 100).toFixed(2)}%`); else setPriceImpact('');
          return;
        }
      } catch {}

      // Fallback: approximate via USD prices
      try {
        let fromPrice = fromTokenPrice ?? undefined;
        let toPrice = toTokenPrice ?? undefined;
        if (typeof fromPrice !== 'number' || typeof toPrice !== 'number') {
          const ids = [fromToken?.symbol || '', toToken?.symbol || ''].filter(Boolean);
          const prices = await jupUsdPrices(ids, 'USDC');
          fromPrice = (typeof fromPrice === 'number') ? fromPrice : prices[fromToken?.symbol ?? ''];
          toPrice = (typeof toPrice === 'number') ? toPrice : prices[toToken?.symbol ?? ''];
        }
        fromPrice = typeof fromPrice === 'number' ? fromPrice : 0;
        toPrice = typeof toPrice === 'number' ? toPrice : 0;
        if (!fromPrice || !toPrice) {
          setToAmount('');
          setFromUsd('');
          setToUsd('');
          setRate('');
          setMinReceived('');
          return;
        }
        const grossUsd = input * fromPrice;
        const netUsd = grossUsd * (1 - FEE_PCT);
        const outAmount = netUsd / toPrice;
        const outStr = outAmount.toFixed(Math.min(outDecimals, 6));
        setToAmount(outStr);
        setFromUsd(`$${grossUsd.toFixed(2)}`);
        setToUsd(`$${(outAmount * toPrice).toFixed(2)}`);
        setRate(`${(outAmount / input).toFixed(6)} ${toToken.symbol}/${fromToken.symbol}`);
        const minOut = outAmount * (1 - slippage / 100);
        setMinReceived(`${minOut.toFixed(Math.min(outDecimals, 6))} ${toToken.symbol}`);
      } catch {
        setToAmount('');
        setFromUsd('');
        setToUsd('');
        setRate('');
        setMinReceived('');
      }
    };
    const timer = setTimeout(computeAmount, 350);
    return () => clearTimeout(timer);
  }, [fromToken, toToken, fromAmount, slippage]);

  // Insufficient balance check
  useEffect(() => {
    const input = parseFloat(fromAmount || '0');
    setInsufficientBalance(!!fromToken && input > (balances[fromToken.address] ?? 0));
  }, [fromAmount, fromToken, balances]);

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
      <div className="relative rounded-2xl border border-white/10 p-6 shadow-2xl overflow-hidden bg-blue-950/25 backdrop-blur-xl">
        {/* Animated dark blue background */}
        <div className="absolute inset-0 -z-10">
          <div className="h-full w-full bg-transparent" />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/50 via-blue-800/50 to-blue-900/50 animate-slow-shift" />
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
          <h2 className="text-2xl font-bold text-white gradient-line">Swap Tokens</h2>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowSlippage(!showSlippage)}
            className="p-2 rounded-lg bg-blue-800/60 hover:bg-blue-700/70 transition-colors"
          >
            <Settings className="h-4 w-4 text-white/70" />
          </motion.button>
        </div>

        {/* From/Sell Section */}
        <div className="relative rounded-xl bg-blue-800/30 p-4 space-y-2">
          <div className="flex justify-between items-center text-sm text-white/60">
            <span>Sell</span>
            <span className="flex items-center gap-2">
              <span>
                Balance: {fromBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} {fromToken?.symbol || ''}
                {sellBalanceUsd && <span className="ml-2 text-white/50">• ~{sellBalanceUsd}</span>}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Input
              type="number"
              placeholder="0.00"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              className="flex-1 bg-blue-900/40 border-white/10 text-white placeholder:text-white/50"
            />
            <div className="w-32 selector-animated">
              <TokenSearch
                selectedToken={fromToken}
                onTokenSelect={handleFromTokenSelect}
                excludeAddress={toToken?.address}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              onClick={handleMaxAmount}
              className="text-xs px-3 py-1 rounded-md bg-blue-700/40 hover:bg-blue-700/60 border border-blue-500/40 text-white/80"
            >
              Max
            </button>
            <button type="button" onClick={() => setPercentOfBalance(0.25)} className="text-xs px-3 py-1 rounded-md bg-blue-700/40 hover:bg-blue-700/60 border border-blue-500/40 text-white/80">25%</button>
            <button type="button" onClick={() => setPercentOfBalance(0.5)} className="text-xs px-3 py-1 rounded-md bg-blue-700/40 hover:bg-blue-700/60 border border-blue-500/40 text-white/80">50%</button>
            <button type="button" onClick={() => setPercentOfBalance(0.75)} className="text-xs px-3 py-1 rounded-md bg-blue-700/40 hover:bg-blue-700/60 border border-blue-500/40 text-white/80">75%</button>
          </div>
          {fromUsd && <div className="text-xs text-white/60">~{fromUsd}</div>}
          {insufficientBalance && (
            <div className="text-xs text-red-400">Insufficient balance</div>
          )}
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

        {/* To/Buy Section */}
        <div className="relative rounded-xl bg-blue-800/30 p-4 space-y-2">
          <div className="flex justify-between items-center text-sm text-white/60">
            <span>Buy</span>
            <span>
              Balance: {buyBalanceEstimate ? Number(buyBalanceEstimate).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0'} {toToken?.symbol || ''}
              {buyBalanceUsd && <span className="ml-2 text-white/50">• ~{buyBalanceUsd}</span>}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Input
              type="number"
              placeholder="0.00"
              value={toAmount}
              readOnly
              className="flex-1 bg-blue-900/40 border-white/10 text-white placeholder:text-white/50"
            />
            <div className="w-32 selector-animated">
              <TokenSearch
                selectedToken={toToken}
                onTokenSelect={handleToTokenSelect}
                excludeAddress={fromToken?.address}
              />
            </div>
          </div>
          {toUsd && <div className="text-xs text-white/60">~{toUsd}</div>}
          {(rate || minReceived || priceImpact) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-white/70 mt-2">
              <div className="bg-blue-900/30 rounded-md p-2 border border-white/10">Rate: {rate}</div>
              <div className="bg-blue-900/30 rounded-md p-2 border border-white/10">Min received: {minReceived}</div>
              <div className="bg-blue-900/30 rounded-md p-2 border border-white/10">Price impact: {priceImpact}</div>
            </div>
          )}
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
          disabled={isSwapping || isProcessing || isEligible === false || insufficientBalance}
          className="w-full mt-6 h-12 rounded-xl btn-neon text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
          ) : insufficientBalance ? (
            'Insufficient balance'
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