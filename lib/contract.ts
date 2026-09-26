import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  http,
  parseEventLogs,
  type Abi,
  type AbiEvent,
  type AbiFunction,
  type Chain,
  type Hash,
  type Log,
  type PublicClient,
  type TransactionReceipt,
  type WalletClient,
} from 'viem';
import { privateRpc } from './chains';

const clients = new Map<string, PublicClient>();

function clientFor(chain: Chain, url: string | undefined): PublicClient {
  const key = `${chain.id}:${url ?? 'public'}`;
  let c = clients.get(key);
  if (!c) {
    c = createPublicClient({
      chain,
      transport: http(url, { timeout: 20_000 }),
      // Reads fired together (State tab, published page) collapse into one Multicall3
      // request — public RPCs rate-limit bursts of parallel eth_calls.
      batch: chain.contracts?.multicall3 ? { multicall: { wait: 20 } } : undefined,
    }) as PublicClient;
    clients.set(key, c);
  }
  return c;
}

/** Reads, simulations, receipts: a user-set RPC, else the configured private RPC, else the public one. */
export function publicClient(chain: Chain, rpcUrl?: string): PublicClient {
  return clientFor(chain, rpcUrl || privateRpc(chain.id));
}

/**
 * Event logs skip the private RPC: Alchemy's free tier caps eth_getLogs at a 10-block range,
 * which breaks history and live watching. Public RPCs allow wider ranges.
 */
function logsClient(chain: Chain, rpcUrl?: string): PublicClient {
  return clientFor(chain, rpcUrl || undefined);
}

export interface Target {
  chain: Chain;
  rpcUrl?: string;
  address: `0x${string}`;
  /** Full ABI — passed along so custom errors decode into readable reasons. */
  abi: Abi;
}

// Call with just the selected function (+ errors) so overloaded names resolve unambiguously.
const callAbi = (t: Target, fn: AbiFunction): Abi => [fn, ...t.abi.filter((i) => i.type === 'error')];

/** `account` sets msg.sender for the call — view functions that depend on the caller need it. */
export async function readFn(t: Target, fn: AbiFunction, args: unknown[], account?: `0x${string}`) {
  return publicClient(t.chain, t.rpcUrl).readContract({
    address: t.address,
    abi: callAbi(t, fn),
    functionName: fn.name,
    args,
    account,
  } as never);
}

export interface SimulationResult {
  result: unknown;
  gas?: bigint;
}

export async function simulateFn(t: Target, fn: AbiFunction, args: unknown[], account: `0x${string}`, value?: bigint): Promise<SimulationResult> {
  const client = publicClient(t.chain, t.rpcUrl);
  const params = { address: t.address, abi: callAbi(t, fn), functionName: fn.name, args, account, value } as never;
  const { result } = await client.simulateContract(params);
  const gas = await client.estimateContractGas(params).catch(() => undefined);
  return { result, gas };
}

export async function sendFn(
  t: Target,
  fn: AbiFunction,
  args: unknown[],
  wallet: WalletClient,
  value?: bigint,
): Promise<Hash> {
  const account = wallet.account;
  if (!account) throw new Error('Wallet has no account');
  return wallet.writeContract({
    address: t.address,
    abi: callAbi(t, fn),
    functionName: fn.name,
    args,
    value,
    chain: t.chain,
    account,
  } as never);
}

export async function waitForReceipt(t: Target, hash: Hash): Promise<{ receipt: TransactionReceipt; events: ReturnType<typeof parseEventLogs> }> {
  const receipt = await publicClient(t.chain, t.rpcUrl).waitForTransactionReceipt({ hash, timeout: 180_000 });
  const events = parseEventLogs({ abi: t.abi, logs: receipt.logs, strict: false });
  return { receipt, events };
}

/** Recent logs for one event, newest first. Walks back in chunks to respect RPC range limits. */
export async function recentLogs(t: Target, event: AbiEvent, blocks = 5_000n, chunk = 1_000n): Promise<Log[]> {
  const client = logsClient(t.chain, t.rpcUrl);
  const latest = await client.getBlockNumber();
  const floor = latest > blocks ? latest - blocks : 0n;
  const out: Log[] = [];
  for (let to = latest; to > floor && out.length < 200; to -= chunk) {
    const from = to - chunk + 1n > floor ? to - chunk + 1n : floor;
    const logs = await client.getLogs({ address: t.address, event, fromBlock: from, toBlock: to });
    out.push(...logs.reverse());
  }
  return out;
}

export function watchEvent(t: Target, event: AbiEvent, onLogs: (logs: Log[]) => void, onError: (e: Error) => void) {
  return logsClient(t.chain, t.rpcUrl).watchContractEvent({
    address: t.address,
    abi: [event],
    eventName: event.name,
    onLogs,
    onError,
    pollingInterval: 4_000,
  } as never);
}

/** Readable reason for any viem error: custom error name + args, revert string, or short message. */
export function explainError(err: unknown): { title: string; detail?: string; rejected: boolean } {
  const e = err as BaseError;
  const rejected = /reject|denied|cancel/i.test(e?.shortMessage ?? e?.message ?? '') || (err as { code?: number })?.code === 4001;
  if (rejected) return { title: 'Rejected in wallet', rejected: true };
  if (e instanceof BaseError) {
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    if (revert) {
      if (revert.data?.errorName) {
        const args = revert.data.args?.map((a) => (typeof a === 'bigint' ? a.toString() : JSON.stringify(a))).join(', ');
        return { title: `Reverted: ${revert.data.errorName}(${args ?? ''})`, detail: e.shortMessage, rejected: false };
      }
      if (revert.reason) return { title: `Reverted: ${revert.reason}`, rejected: false };
    }
    return { title: e.shortMessage || e.message.split('\n')[0], detail: e.details, rejected: false };
  }
  return { title: (err as Error)?.message ?? String(err), rejected: false };
}
