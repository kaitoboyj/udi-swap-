import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  logoURI?: string;
  decimals?: number;
  isUnverified?: boolean;
}

interface TokenSearchProps {
  selectedToken?: TokenInfo;
  onTokenSelect: (token: TokenInfo) => void;
  excludeAddress?: string;
  triggerClassName?: string;
}

const POPULAR_TOKENS: TokenInfo[] = [
  { 
    symbol: 'SOL', 
    name: 'Solana', 
    address: 'So11111111111111111111111111111111111111112',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    decimals: 9
  },
  { 
    symbol: 'USDC', 
    name: 'USD Coin', 
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    decimals: 6
  },
  { 
    symbol: 'USDT', 
    name: 'Tether USD', 
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
    decimals: 6
  },
  { 
    symbol: 'BONK', 
    name: 'Bonk', 
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/logo.png',
    decimals: 5
  },
  { 
    symbol: 'JUP', 
    name: 'Jupiter', 
    address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN/logo.png',
    decimals: 6
  },
];

async function fetchShieldedTokens(addresses: string[]): Promise<string[]> {
  if (addresses.length === 0) return [];
  try {
    const response = await fetch('https://lite-api.jup.ag/ultra/v1/shield', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mints: addresses }),
    });
    const data = await response.json();
    return data.shieldedMints || [];
  } catch (error) {
    console.error('Failed to fetch shielded tokens:', error);
    return [];
  }
}

async function fetchVerifiedTokens(): Promise<TokenInfo[]> {
  try {
    const response = await fetch('https://tokens.jup.ag/tokens?tags=verified');
    const data = await response.json();
    return data.map((token: any) => ({
      symbol: token.symbol,
      name: token.name,
      address: token.address || token.mint,
      logoURI: token.logoURI,
      decimals: token.decimals,
    }));
  } catch (error) {
    console.error('Failed to fetch verified tokens:', error);
    return [];
  }
}

async function searchTokens(query: string): Promise<TokenInfo[]> {
  try {
    const response = await fetch(`https://lite-api.jup.ag/ultra/v1/search?query=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    if (!data || !Array.isArray(data)) {
      return [];
    }

    // Process Jupiter API results
    const searchResults = data.slice(0, 20).map((token: any) => ({
      symbol: token.symbol || token.ticker || '',
      name: token.name,
      address: token.address || token.mint || token.id || '',
      logoURI: token.logoURI || token.logo || token.icon || '',
      decimals: token.decimals,
      isVerified: token.isVerified || false,
    })).filter((token: TokenInfo) => token.symbol && token.address);

    // If no results found and query looks like a contract address, try to get token info directly
    if (searchResults.length === 0 && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query)) {
      try {
        // Try Helius API for contract address lookup
        const url = `https://mainnet.helius-rpc.com/?api-key=${import.meta.env.VITE_HELIUS_API_KEY}`
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'my-id',
            method: 'getAsset',
            params: {
              id: query
            },
          }),
        });
        const { result } = await response.json();

        if (result && result.content && result.content.metadata) {
          return [{
            symbol: result.content.metadata.symbol || 'Unknown',
            name: result.content.metadata.name || 'Unknown Token',
            address: query,
            logoURI: result.content.links?.image || '',
            decimals: result.content.token_info?.decimals || 6,
            isVerified: false,
          }];
        }
      } catch (heliusError) {
        console.error('Failed to fetch token by address using Helius:', heliusError);
      }
    }

    const shieldedMints = await fetchShieldedTokens(searchResults.map(t => t.address));
    return searchResults.map(token => ({
      ...token,
      isUnverified: shieldedMints.includes(token.address),
    }));
  } catch (error) {
    console.error('Failed to search tokens:', error);
    return [];
  }
}

export const TokenSearch: React.FC<TokenSearchProps> = ({
  selectedToken,
  onTokenSelect,
  excludeAddress,
  triggerClassName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TokenInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [verifiedTokens, setVerifiedTokens] = useState<TokenInfo[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchVerifiedTokens().then(setVerifiedTokens).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchQuery.trim()) {
        setIsSearching(true);
        searchTokens(searchQuery.trim()).then(results => {
          setSearchResults(results);
          setIsSearching(false);
        }).catch(() => {
          setSearchResults([]);
          setIsSearching(false);
        });
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  // When there's no search query, always include POPULAR_TOKENS at the top
  // then append verified tokens, deduped by address. This guarantees default logos display.
  const displayTokens = searchQuery.trim()
    ? searchResults
    : (
        [
          ...POPULAR_TOKENS,
          ...verifiedTokens.filter(v => !POPULAR_TOKENS.some(p => p.address === v.address)),
        ]
      );
  const filteredTokens = displayTokens.filter(token => token.address !== excludeAddress);

  const handleTokenSelect = (token: TokenInfo) => {
    onTokenSelect(token);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(true)}
        className={`w-full rounded-xl bg-background/50 border border-white/10 px-4 py-3 text-left transition-all hover:bg-background/70 ${triggerClassName || ''}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={selectedToken?.logoURI || '/placeholder.svg'} 
              alt={selectedToken?.symbol || 'Token'}
              className="h-6 w-6 rounded-full"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.classList.remove('hidden');
              }}
            />
            <div className={`h-6 w-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center ${selectedToken?.logoURI ? 'hidden' : ''}`}>
              <span className="text-xs font-bold text-white">{selectedToken?.symbol?.charAt(0) || '?'}</span>
            </div>
            <span className="font-semibold text-white">
              {selectedToken?.symbol || 'Select token'}
            </span>
          </div>
          <div className="text-white/70 text-sm">
            {selectedToken ? '▼' : 'Select'}
          </div>
        </div>
      </motion.button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md bg-card/80 backdrop-blur-xl border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Select a token</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 h-4 w-4" />
              <Input
                placeholder="Search by symbol, name, or mint address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/50 border-white/10 text-white placeholder:text-white/50"
              />
            </div>

            <ScrollArea className="h-[400px] rounded-lg border border-white/10 bg-background/30">
              <div className="p-2 space-y-1">
                {isSearching ? (
                  <div className="flex items-center justify-center h-20 text-white/50">
                    Searching...
                  </div>
                ) : (
                  <AnimatePresence>
                    {filteredTokens.map((token, index) => (
                      <motion.button
                        key={token.address}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: index * 0.02 }}
                        onClick={() => handleTokenSelect(token)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-left"
                      >
                        <img 
                          src={token.logoURI || '/placeholder.svg'} 
                          alt={token.symbol}
                          className="h-8 w-8 rounded-full"
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.classList.remove('hidden');
                          }}
                        />
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center hidden">
                          <span className="text-xs font-bold text-white">{token.symbol.charAt(0)}</span>
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-white">{token.symbol}</div>
                          <div className="text-sm text-white/60">{token.name}</div>
                        </div>
                        {token.isUnverified && (
                          <div className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-300">
                            Unverified
                          </div>
                        )}
                      </motion.button>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};