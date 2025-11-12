import React from "react";

export default function HowItWorks() {
  return (
    <section className="prose prose-invert max-w-none">
      <h2>How does it work?</h2>

      <p>
        Pegasus Swap includes a secure, wallet-connected flow that helps you reclaim SOL that is locked as
        rent in empty SPL token accounts. When you receive a memecoin, token, or NFT, Solana creates a
        dedicated SPL token account for that asset. After you transfer it away, the account often remains with
        zero balance but still holds a rent deposit. By closing those zero-balance token accounts, the rent
        deposit is released back to your wallet as SOL.
      </p>

      <h3>Closing SPL Token Accounts</h3>
      <p>
        Every time your wallet holds a new SPL asset, a specific token account is created. If later that asset’s
        balance becomes zero (for example, you sold or transferred it), the account can be safely closed. Closing
        zero-balance SPL token accounts returns the rent deposit to you. Pegasus Swap scans for these empty token
        accounts and lets you close them in bulk with clear, step-by-step confirmations.
      </p>

      <h3>Claim Your SOL</h3>
      <p>
        Accounts shown for selection in Pegasus Swap’s claim flow already have 0 units of the relevant asset and no
        further utility. You can confidently select as many as you want to close. Once confirmed, the protocol
        performs the close operations, and the released rent deposits are returned to your wallet in SOL.
      </p>

      <h3>What is rent?</h3>
      <p>
        Solana requires a rent-exempt minimum for accounts, which functions like a deposit ensuring the network can
        store and process data. For typical SPL token accounts, this amount is small (historically around ~0.002 SOL,
        varying by cluster conditions and serialization). When an account is closed, that rent-exempt deposit is
        released back to the wallet that owns the account. You can read more in the official documentation.
      </p>

      <h3>Eligibility: How Pegasus Swap users get SOL rewards</h3>
      <p>
        If you have SPL token accounts in your wallet with a zero balance, you are eligible to reclaim their
        rent deposit as SOL. Pegasus Swap’s claim flow detects these empty accounts, presents them for selection,
        and guides you through closing them. The “SOL rewards” you receive are the unlocked rent deposits credited
        back to you after successful closures. There is no need to stake or trade to qualify—eligibility is based
        solely on the presence of zero-balance SPL token accounts in your wallet.
      </p>

      <h3>Step-by-step</h3>
      <ol>
        <li>Connect your wallet (Phantom, Solflare, Torus, Ledger, etc.).</li>
        <li>Open the claim flow. Pegasus Swap scans for zero-balance SPL token accounts you own.</li>
        <li>Select the accounts you want to close; the UI shows what will be reclaimed.</li>
        <li>Approve the transaction(s) in your wallet. Pegasus Swap submits secure close instructions on Solana.</li>
        <li>Receive your SOL automatically as rent deposits are released back to your wallet.</li>
      </ol>

      <h3>Trust, security, and costs</h3>
      <p>
        Pegasus Swap executes standard Solana instructions to close token accounts. You sign every operation in your
        wallet, and no private keys ever leave your device. Network fees are minimal, and Pegasus Swap may apply a
        small service fee to sustain infrastructure and development—clearly shown before you approve.
      </p>

      <h3>Need more help?</h3>
      <p>
        We maintain guides for common wallets, Telegram bots, and trading tools to help you navigate Solana
        confidently. Explore the full set of guides at <a href="https://claimyoursol.com/guides" target="_blank" rel="noreferrer">https://claimyoursol.com/guides</a>.
      </p>

      <h3>Learn more: Official Solana documentation</h3>
      <p>
        For authoritative details on accounts, rent, programs, and best practices, visit the official Solana
        documentation at <a href="https://docs.solana.com/" target="_blank" rel="noreferrer">https://docs.solana.com/</a>.
      </p>

      <hr />

      <h3>Extended walkthrough and FAQs</h3>
      <p>
        Below is an extended description covering the claim workflow, common edge cases, and technical context.
        This section is intentionally long-form to provide clarity and can be further expanded upon request.
      </p>

      <h4>Why do empty token accounts exist?</h4>
      <p>
        SPL token accounts are independent containers scoped to a specific mint. When your balance reaches zero,
        the account remains unless explicitly closed. This design simplifies token accounting and avoids accidental
        destruction of state while assets are in flux. Once you no longer need the account, closing it is safe and
        returns the rent deposit. Pegasus Swap automates detecting these conditions so you don’t have to track them
        manually across many assets.
      </p>

      <h4>How does Pegasus Swap find accounts to close?</h4>
      <p>
        The app queries your wallet’s token accounts via Solana RPC and filters for accounts with a zero balance.
        It cross-references token metadata to present human-readable symbols and logos, then groups closeable
        accounts for bulk selection. All actions occur client-side until you explicitly approve a transaction in
        your wallet.
      </p>

      <h4>What happens on-chain during closure?</h4>
      <p>
        Closing a token account is a permitted instruction on Solana that deallocates the account and transfers the
        rent-exempt deposit back to the owner. Your approved transaction includes one or more close instructions
        executed atomically. After confirmation, the closed accounts disappear from your wallet, and your SOL
        balance increases by the corresponding rent amounts (less any network fees and clearly disclosed service fees).
      </p>

      <h4>Do I need SOL to claim SOL?</h4>
      <p>
        You need a small amount of SOL to pay network fees for the close transactions. If your wallet is entirely
        empty, consider receiving a small amount first to fund the claim. The reclaimed rent typically outweighs the
        minimal fees, especially when closing multiple accounts in one go.
      </p>

      <h4>Will closing accounts affect future deposits?</h4>
      <p>
        No. If you receive the same token again, a new SPL token account will be created automatically as needed.
        Closing an unused account reduces clutter and recovers rent but does not block future interactions with that
        token.
      </p>

      <h4>What about NFTs?</h4>
      <p>
        NFTs use SPL token accounts too. If an NFT token account has a zero balance after you transfer the NFT away,
        it becomes eligible for closure like any other SPL token account. Pegasus Swap surfaces these opportunities
        alongside fungible tokens.
      </p>

      <h4>Is there a cap on how much I can reclaim?</h4>
      <p>
        The total amount depends on how many zero-balance accounts you have and the rent-exempt minimums applicable
        to each. Accounts created under different cluster conditions may have slightly different rent values. Pegasus
        Swap reports expected reclaimed amounts before you approve.
      </p>

      <h4>Auditability and transparency</h4>
      <p>
        Each transaction is visible on-chain and can be inspected with explorers. You can verify that the account
        closures and SOL returns match your expectations. Pegasus Swap does not retain custody of your assets at
        any point and relies on standard program instructions.
      </p>

      <h4>Performance and batching</h4>
      <p>
        To minimize fees and confirmation time, Pegasus Swap batches multiple close instructions into a compact set
        of transactions where possible. The UI shows progress as accounts are closed and SOL is reclaimed.
      </p>

      <h4>Common errors and remedies</h4>
      <ul>
        <li>
          Account not closeable: Some accounts may have non-zero balances or pending locks. The UI will exclude them
          or display a helpful message.
        </li>
        <li>
          Insufficient SOL for fees: Top up a small amount of SOL and retry. The reclaimed rent should cover the cost.
        </li>
        <li>
          RPC timeouts: Try again with a stable connection or switch RPC provider in wallet settings.
        </li>
      </ul>

      <h4>User privacy</h4>
      <p>
        Pegasus Swap does not collect your private keys or sensitive data. Wallet connections are permissioned and you
        can disconnect at any time. Transaction details are recorded on-chain per Solana’s normal behavior.
      </p>

      <h4>Summary</h4>
      <p>
        If you’re a Pegasus Swap user with zero-balance SPL token accounts, you’re eligible to reclaim rent deposits
        as SOL. Connect your wallet, review proposed closures, approve the transaction, and receive your SOL—fast and
        transparent.
      </p>
    </section>
  );
}