# Kendra

Smart contract playground by Awarizon. Paste an ABI, enter the address, pick a chain, and work with the contract in a browser IDE. Generate typed React hooks (same output as `npx @awarizon/cli generate`) and publish a simple dApp UI with one click.

Runs at **kendra.awarizon.com**.

## Features

- **Contract setup:** paste a JSON ABI, a Hardhat/Foundry artifact, or human-readable signatures, or upload a `.json` file. Supports 30+ EVM chains plus `localhost:8545`, with an optional custom RPC.
- **Playground:** each function gets typed inputs. Integers accept `42`, `0x2a`, `1e18` or `1.5 ether`; arrays and tuples take JSON. Calling a read shows the decoded, named outputs.
- **Writes:** writes are simulated first, so a revert shows its reason (including custom errors) before you sign. After sending, the receipt, gas used and decoded events are shown.
- **State:** every zero-argument view function, fetched in a single multicall, with optional auto-refresh.
- **Events:** fetch recent logs, or watch for new ones live.
- **Hooks & code:** a typed contract client and React hooks in TypeScript or JavaScript, to copy or download.
- **Console:** a running log of calls, simulations and transactions, with explorer links.
- **Publish UI:** creates a clean dApp page at `/c#…` with an overview, lookups and actions.

## No backend

Nothing is stored on a server.

- The workspace and recent contracts are saved in the browser's `localStorage`.
- A published UI is the contract definition compressed into the URL fragment (`/c#…`). Browsers never send the fragment to the server, so the ABI stays with whoever holds the link.

## Develop

```bash
npm install
npm run dev        # http://localhost:3300
npm test           # ABI parsing, argument encoding, share links
npm run build
```

## Deploy

This is a standard Next.js 14 app with no environment variables. On Vercel, import the repo and add the domain `kendra.awarizon.com`.
