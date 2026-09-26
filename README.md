# Kendra

Smart contract playground by Awarizon. Paste an ABI, enter the address, pick a chain, and work with the contract in a browser IDE. Generate typed React hooks (same output as `npx @awarizon/cli generate`) and publish a simple dApp UI with one click.

Runs at **kendra.awarizon.com**.

## Features

- **Contract setup:** paste a JSON ABI, a Hardhat/Foundry artifact, or human-readable signatures, or upload a `.json` file. Supports 10 mainnets (Ethereum, Arbitrum, OP, Polygon, zkSync, Linea, World Chain, Robinhood Chain, Mantle, Berachain) and 3 testnets (Sepolia, Arbitrum Sepolia, OP Sepolia), with an optional custom RPC.
- **Wallets:** connect through RainbowKit, which covers MetaMask, Rainbow, Base, WalletConnect and more. Kendra switches the wallet to the contract's chain when needed.
- **ABI auto-fetch:** paste an address and Kendra loads the verified ABI from Sourcify, then Blockscout, then Etherscan (if `NEXT_PUBLIC_ETHERSCAN_API_KEY` is set). Proxies are resolved through the contract's metadata or its EIP-1967 storage slots, and the proxy's and implementation's functions are merged into one list.
- **Token-aware numbers:** if the contract has `decimals()`, amounts show in token units (e.g. `= 79,178.60 USDC`). Amount inputs get a one-click symbol helper (`12.5` becomes `12.5e6`) and a live preview.
- **Simulate as (fork mode):** run reads and simulations as any address, with no wallet needed. Useful for testing admin-only or balance-dependent paths. Transactions are still always sent from your wallet.
- **Playground:** each function gets typed inputs. Integers accept `42`, `0x2a`, `1e18` or `1.5 ether`; arrays and tuples take JSON. Calling a read shows the decoded, named outputs.
- **Writes:** writes are simulated first, so a revert shows its reason (including custom errors) before you sign. After sending, the receipt, gas used and decoded events are shown.
- **State:** every zero-argument view function, fetched in a single multicall, with optional auto-refresh.
- **Events:** fetch recent logs, or watch for new ones live.
- **Hooks & code:** a typed contract client and React hooks in TypeScript or JavaScript, to copy or download.
- **Console:** a running log of calls, simulations and transactions, with explorer links. Replay any entry to reload its inputs, or export the whole session as JSON.
- **Publish UI:** creates a clean dApp page at `/c#…` with an overview, lookups and actions.

## No backend

Nothing is stored on a server.

- The workspace and recent contracts are saved in the browser's `localStorage`.
- A published UI is the contract definition compressed into the URL fragment (`/c#…`). Browsers never send the fragment to the server, so the ABI stays with whoever holds the link.

## Environment

Copy `.env.example` to `.env.local`:

- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is required by RainbowKit. It is a public ID, already set in `.env`.
- `NEXT_PUBLIC_RPC_<CHAIN>` holds the private RPC URLs (Alchemy). Any chain left blank uses its public RPC.

RPC routing:

- Reads, simulations and receipts go to the private RPC.
- Event logs go to the chain's public RPC, because Alchemy's free tier limits `eth_getLogs` to a 10-block range.
- Wallets only ever receive public RPCs.

The RPC URLs are visible in the browser, so restrict the Alchemy key to your domains.

## Develop

```bash
npm install
npm run dev        # http://localhost:3300
npm test           # ABI parsing, argument encoding, share links
npm run build
```

## Deploy

This is a standard Next.js 14 app. On Vercel, import the repo, add the `NEXT_PUBLIC_RPC_*` variables from `.env.example`, and add the domain `kendra.awarizon.com`.

To check a build while `npm run dev` is running, use `NEXT_DIST_DIR=.next-verify npm run build`. Otherwise both processes write to `.next` and break each other.
