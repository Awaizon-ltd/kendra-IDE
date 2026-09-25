'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useSwitchChain } from 'wagmi';
import type { Chain } from 'viem';
import { Button } from './ui/primitives';

/**
 * RainbowKit connect button styled for Kendra. When `chain` is given (the contract's
 * network), a connected wallet on another network gets a one-click switch.
 */
export default function WalletButton({ chain }: { chain?: Chain }) {
  const { switchChain, isPending } = useSwitchChain();

  return (
    <ConnectButton.Custom>
      {({ account, chain: walletChain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        // Render nothing interactive until RainbowKit has restored the session (avoids a flash)
        if (!mounted) return <div aria-hidden className="w-[132px] h-[30px] opacity-0" />;

        if (!account || !walletChain) {
          return <Button variant="ghost" size="sm" onClick={openConnectModal}>Connect wallet</Button>;
        }
        if (walletChain.unsupported) {
          return <Button variant="danger" size="sm" onClick={openChainModal}>Unsupported network</Button>;
        }
        if (chain && walletChain.id !== chain.id) {
          return (
            <Button variant="danger" size="sm" loading={isPending} onClick={() => switchChain({ chainId: chain.id })}>
              Switch to {chain.name}
            </Button>
          );
        }
        return (
          <button
            onClick={openAccountModal}
            className="flex items-center gap-2 border border-line-bright px-3 py-1.5 hover:border-white/30 transition-colors"
          >
            {walletChain.hasIcon && walletChain.iconUrl && <img src={walletChain.iconUrl} alt={walletChain.name ?? ''} className="w-4 h-4" />}
            <span className="w-1.5 h-1.5 rounded-full bg-ok" />
            <span className="font-mono text-[11px] text-white">{account.displayName}</span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
