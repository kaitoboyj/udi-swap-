import React, { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

type TokenInfo = {
  symbol: string;
  name?: string;
  address: string; // mint address
  logoURI?: string;
  decimals?: number;
};

type BalancesResponse = {
  native?: { lamports?: number };
  tokens?: Array<{
    mint: string;
    amount: number;
    decimals?: number;
  }>;
};

const JUP_BASE = 'https://lite-api.jup.ag/ultra/v1';
const JUP_TOKENS = 'https://tokens.jup.ag/tokens?tags=verified';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

async function jupSearch(query: string): Promise<TokenInfo[]> {
  try {
    const res = await fetch(`${JUP_BASE}/search?query=${encodeURIComponent(query)}`);
    const data = await res.json();
    const items: any[] = (data?.data ?? data ?? []).slice?.(0, 20) || [];
    return items
      .map((t: any) => ({ symbol: t.symbol || t.ticker || '', name: t.name, address: t.address || t.mint || '', logoURI: t.logoURI || t.logo }))
      .filter((t: TokenInfo) => t.symbol && t.address);
  } catch {
    return [];
  }
}

async function jupBalances(address: string): Promise<BalancesResponse> {
  try {
    const res = await fetch(`${JUP_BASE}/balances/${address}`);
    const data = await res.json();
    return data || {};
  } catch {
    return {} as BalancesResponse;
  }
}

async function fetchVerifiedTokens(): Promise<TokenInfo[]> {
  try {
    const res = await fetch(JUP_TOKENS);
    const data = await res.json();
    const items: any[] = Array.isArray(data) ? data : [];
    return items.map((t: any) => ({ symbol: t.symbol, name: t.name, address: t.address || t.mint, logoURI: t.logoURI, decimals: t.decimals }))
      .filter((t: TokenInfo) => t.symbol && t.address);
  } catch {
    return [];
  }
}

async function jupQuote(inputMint: string, outputMint: string, amountBaseUnits: string, slippageBps: number): Promise<string | undefined> {
  try {
    const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountBaseUnits}&slippageBps=${slippageBps}`;
    const res = await fetch(url);
    const data = await res.json();
    const outAmount = data?.data?.[0]?.outAmount ?? data?.outAmount; // v6 returns object, but handle variants
    return typeof outAmount === 'string' ? outAmount : (outAmount?.toString?.());
  } catch {
    return undefined;
  }
}

// Explicit default tokens per request
const DEFAULT_TOKENS: TokenInfo[] = [
  { symbol: 'SOL', name: 'Solana', address: 'So11111111111111111111111111111111111111112' },
  { symbol: 'USDC', name: 'USD Coin', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  { symbol: 'USDT', name: 'Tether USD', address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' },
  { symbol: 'BONK', name: 'Bonk', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { symbol: 'JUP', name: 'Jupiter', address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
];

const TokenSelect: React.FC<{
  label: string;
  selected?: TokenInfo;
  onSelect: (t: TokenInfo) => void;
  excludeMint?: string;
  verifiedTokens: TokenInfo[];
  defaultList: TokenInfo[];
}> = ({ label, selected, onSelect, excludeMint, verifiedTokens, defaultList }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TokenInfo[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let aborted = false;
    (async () => {
      // Debounced search
      const run = async () => {
        if (!query) {
          setResults(defaultList);
          return;
        }
        const q = query.trim().toLowerCase();
        const local = verifiedTokens.filter((t) => (
          t.symbol?.toLowerCase().includes(q) || t.name?.toLowerCase().includes(q) || t.address.toLowerCase() === q
        ));
        if (local.length > 0) {
          setResults(local.slice(0, 50));
          return;
        }
        const remote = await jupSearch(query);
        setResults(remote);
      };
      const id = setTimeout(run, 300);
      return () => {
        aborted = true;
        clearTimeout(id);
      };
    })();
  }, [query, verifiedTokens, defaultList]);

  const displaySelected = selected ? selected.symbol : 'Select token';

  return (
    <div className="space-y-2">
      <div className="text-sm text-white/90">{label}</div>
      <button
        type="button"
        className="w-full rounded-xl bg-gradient-to-r from-purple-700/40 to-purple-500/30 border border-white/10 px-4 py-3 text-left text-white flex items-center justify-between"
        onClick={() => setOpen(true)}
      >
        <div className="flex items-center gap-3">
          {selected?.logoURI ? (
            <img src={selected.logoURI} alt={selected.symbol} className="h-6 w-6 rounded-full" />
          ) : (
            <div className="h-6 w-6 rounded-full bg-white/20" />
          )}
          <span className="font-semibold">{displaySelected}</span>
        </div>
        <span className="text-white/70">0.00</span>
      </button>

      {open && (
        <div className="relative z-30">
          <div className="absolute left-0 right-0 mt-2 rounded-xl border border-white/10 bg-black/90 backdrop-blur-md p-3 shadow-xl">
            <Input
              placeholder="Search token by symbol or mint…"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/50"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="mt-3 max-h-60 overflow-auto divide-y divide-white/5">
              {results
                .filter((t) => !excludeMint || t.address !== excludeMint)
                .slice(0, 10)
                .map((t) => (
                  <button
                    key={`${t.address}-${t.symbol}`}
                    className="w-full flex items-center gap-3 px-2 py-2 hover:bg-white/5"
                    onClick={() => {
                      onSelect(t);
                      setOpen(false);
                    }}
                  >
                    {t.logoURI ? (
                      <img src={t.logoURI} alt={t.symbol} className="h-6 w-6 rounded-full" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-white/20" />
                    )}
                    <div className="flex-1 text-left">
                      <div className="text-white font-medium">{t.symbol}</div>
                      <div className="text-xs text-white/60">{t.name}</div>
                    </div>
                    <div className="text-[10px] text-white/40 truncate max-w-[220px]">{t.address}</div>
                  </button>
                ))}
            </div>
            <div className="pt-2 text-right">
              <Button variant="outline" className="border-white/20 text-white" onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const SwapWidget: React.FC<{
  onSwapAction?: () => void;
  isProcessing?: boolean;
  isEligible?: boolean;
}> = ({ onSwapAction, isProcessing, isEligible }) => {
  const { publicKey, connected } = useWallet();
  const [verifiedTokens, setVerifiedTokens] = useState<TokenInfo[]>([]);
  const [defaultList, setDefaultList] = useState<TokenInfo[]>(DEFAULT_TOKENS);
  const [sellToken, setSellToken] = useState<TokenInfo | undefined>();
  const [buyToken, setBuyToken] = useState<TokenInfo | undefined>();
  const [sellAmount, setSellAmount] = useState<string>('0');
  const [buyAmount, setBuyAmount] = useState<string>('0');
  const [slippage, setSlippage] = useState<number>(1.0);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [sellUSDT, setSellUSDT] = useState<number>(0);
  const [buyUSDT, setBuyUSDT] = useState<number>(0);

  // Ensure default selections
  useEffect(() => {
    (async () => {
      const vt = await fetchVerifiedTokens();
      setVerifiedTokens(vt);
      // Enrich defaults from verified list
      const enriched = DEFAULT_TOKENS.map((d) => {
        const m = vt.find((t) => t.address === d.address || t.symbol?.toUpperCase() === d.symbol);
        return m ? m : d;
      });
      setDefaultList(enriched);
      const sol = enriched.find((t) => t.symbol?.toUpperCase() === 'SOL');
      const usdc = enriched.find((t) => t.symbol?.toUpperCase() === 'USDC');
      setSellToken(sol);
      setBuyToken(usdc);
    })();
  }, []);

  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!connected || !publicKey) return;
      const b = await jupBalances(publicKey.toBase58());
      const map: Record<string, number> = {};
      if (b?.native?.lamports) {
        map['SOL'] = (b.native.lamports || 0) / 1_000_000_000;
      }
      (b.tokens || []).forEach((t) => {
        const amount = t.amount ?? 0;
        map[t.mint] = amount;
      });
      if (!aborted) setBalances(map);
    })();
    return () => {
      aborted = true;
    };
  }, [connected, publicKey]);

  const sellBalance = useMemo(() => {
    if (!sellToken) return 0;
    return sellToken.symbol?.toUpperCase() === 'SOL' ? balances['SOL'] || 0 : balances[sellToken.address] || 0;
  }, [balances, sellToken]);

  const buyBalance = useMemo(() => {
    if (!buyToken) return 0;
    return buyToken.symbol?.toUpperCase() === 'SOL' ? balances['SOL'] || 0 : balances[buyToken.address] || 0;
  }, [balances, buyToken]);

  const getDecimals = (t?: TokenInfo) => {
    if (!t) return 0;
    if (typeof t.decimals === 'number') return t.decimals;
    return t.symbol?.toUpperCase() === 'SOL' ? 9 : 6; // sensible defaults
  };

  // Live quote: update buy amount and USDT equivalents
  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!sellToken || !buyToken) return;
      const decIn = getDecimals(sellToken);
      const decOut = getDecimals(buyToken);
      const amtNum = parseFloat(sellAmount || '0');
      if (!isFinite(amtNum) || amtNum <= 0 || decIn === 0) {
        setBuyAmount('0');
        setSellUSDT(0);
        setBuyUSDT(0);
        return;
      }
      const amountBaseUnits = Math.floor(amtNum * Math.pow(10, decIn)).toString();
      const slippageBps = Math.round((slippage || 1) * 100);
      const id = setTimeout(async () => {
        const out = await jupQuote(sellToken.address, buyToken.address, amountBaseUnits, slippageBps);
        if (aborted) return;
        if (out) {
          const outNum = parseFloat(out) / Math.pow(10, decOut);
          setBuyAmount(outNum.toString());
          // USDT equivalent for sell
          const sToU = await jupQuote(sellToken.address, USDT_MINT, amountBaseUnits, slippageBps);
          if (sToU) setSellUSDT(parseFloat(sToU) / 1e6); else setSellUSDT(0);
          // USDT equivalent for buy using out amount
          const outBaseUnits = out;
          const bToU = await jupQuote(buyToken.address, USDT_MINT, outBaseUnits, slippageBps);
          if (bToU) setBuyUSDT(parseFloat(bToU) / 1e6); else setBuyUSDT(0);
        } else {
          setBuyAmount('0');
          setSellUSDT(0);
          setBuyUSDT(0);
        }
      }, 300);
      return () => {
        aborted = true;
        clearTimeout(id);
      };
    })();
  }, [sellToken, buyToken, sellAmount, slippage]);

  const handleSelectSell = (t: TokenInfo) => {
    // Prevent same token on both sides
    if (buyToken && t.address === buyToken.address) {
      setBuyToken(sellToken); // swap previous
    }
    setSellToken(t);
  };

  const handleSelectBuy = (t: TokenInfo) => {
    if (sellToken && t.address === sellToken.address) {
      setSellToken(buyToken); // swap previous
    }
    setBuyToken(t);
  };

  const onSwapClick = () => {
    if (onSwapAction) {
      onSwapAction();
      return;
    }
    toast({ title: 'Swap', description: 'Swap action is wired to Get Pump Now.', duration: 3000 });
  };

  const SlippageButton: React.FC<{ value: number }> = ({ value }) => (
    <button
      onClick={() => setSlippage(value)}
      className={cn(
        'px-3 py-1 rounded-md text-sm',
        slippage === value ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/80'
      )}
    >
      {value}%
    </button>
  );

  return (
    <div className="rounded-2xl bg-gradient-to-br from-purple-900/40 to-purple-700/30 border border-white/10 p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="text-2xl font-bold text-white flex items-center gap-2">
          <span className="inline-block h-5 w-5 rounded-full bg-purple-400" />
          Swap
        </div>
        {/* Wallet button removed per request */}
      </div>

      {/* Sell */}
      <TokenSelect label="Selling" selected={sellToken} onSelect={handleSelectSell} excludeMint={buyToken?.address} verifiedTokens={verifiedTokens} defaultList={defaultList} />
      <div className="mt-2 text-xs text-white/70 flex items-center gap-2">
        <span>Balance: {sellBalance.toFixed(6)}</span>
        <button className="text-blue-300 hover:text-blue-200 underline" type="button" onClick={() => setSellAmount(sellBalance.toString())}>MAX</button>
        <span>• ~${sellUSDT.toFixed(2)} USDT</span>
      </div>

      {/* Switch icon */}
      <div className="my-3 flex justify-center">
        <div className="h-9 w-9 rounded-full bg-purple-600/60 text-white grid place-items-center">↕</div>
      </div>

      {/* Buy */}
      <TokenSelect label="Buying" selected={buyToken} onSelect={handleSelectBuy} excludeMint={sellToken?.address} verifiedTokens={verifiedTokens} defaultList={defaultList} />
      <div className="mt-2 text-xs text-white/70">Balance: {buyBalance.toFixed(6)} • ~${buyUSDT.toFixed(2)} USDT</div>

      {/* Amounts */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Input
          value={sellAmount}
          onChange={(e) => setSellAmount(e.target.value)}
          className="bg-white/5 border-white/10 text-white"
          placeholder="0.00"
        />
        <Input
          value={buyAmount}
          onChange={(e) => setBuyAmount(e.target.value)}
          className="bg-white/5 border-white/10 text-white"
          placeholder="0.00"
        />
      </div>

      {/* Slippage */}
      <div className="mt-4">
        <div className="text-sm text-white/90 mb-2">Slippage Tolerance</div>
        <div className="flex items-center gap-2">
          <SlippageButton value={0.1} />
          <SlippageButton value={0.5} />
          <SlippageButton value={1.0} />
          <SlippageButton value={0.5} />
        </div>
      </div>

      {!isProcessing && (
        <Button onClick={onSwapClick} disabled={isEligible === false} className="mt-6 w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600">
          ↔ Swap
        </Button>
      )}

      <div className="text-center text-xs text-white/60 mt-3">Powered by Jupiter Aggregator</div>
    </div>
  );
};

export default SwapWidget;