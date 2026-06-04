import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";

export const ethClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.NEXT_PUBLIC_ETH_RPC),
});

export const PKMN_CONTRACT    = process.env.NEXT_PUBLIC_PKMN_CONTRACT    as `0x${string}`;
export const VAULT_CONTRACT   = process.env.NEXT_PUBLIC_VAULT_CONTRACT   as `0x${string}`;
export const HOOK_CONTRACT    = process.env.NEXT_PUBLIC_HOOK_CONTRACT    as `0x${string}`;
export const WETH_MAINNET     = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as `0x${string}`;

export const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
]);

export const EVOLUTION_HOOK_ABI = parseAbi([
  "function evolutionLevel(address) view returns (uint8)",
  "function getLiveLevel(address) view returns (uint8)",
  "function evolutionProgress(address) view returns (uint256)",
  "function swapCount(bytes32) view returns (uint256)",
  "function traderVolume(address) view returns (uint256)",
  "event Evolved(address indexed trainer, uint8 indexed fromLevel, uint8 indexed toLevel, uint256 balance)",
  "event Devolved(address indexed trainer, uint8 indexed fromLevel, uint8 indexed toLevel, uint256 balance)",
]);

export const VAULT_ABI = parseAbi([
  "function currentRoundId() view returns (uint256)",
  "function rounds(uint256) view returns (bytes32 merkleRoot, uint256 totalEth, uint256 claimedEth, uint256 startsAt, uint256 expiresAt, bool finalized)",
  "function hasClaimed(uint256, address) view returns (bool)",
  "function claim(uint256 roundId, uint256 amount, bytes32[] calldata proof)",
  "function canClaim(uint256 roundId, address trainer, uint256 amount, bytes32[] calldata proof) view returns (bool)",
  "function timeUntilExpiry() view returns (uint256)",
  "function fund() payable",
  "event Claimed(uint256 indexed roundId, address indexed trainer, uint256 amount)",
  "event RoundOpened(uint256 indexed roundId, uint256 startsAt)",
  "event RootPosted(uint256 indexed roundId, bytes32 root, uint256 totalEth)",
]);

export async function getTokenBalance(wallet: string): Promise<bigint> {
  return ethClient.readContract({
    address: PKMN_CONTRACT,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [wallet as `0x${string}`],
  });
}

export async function getTokenDecimals(): Promise<number> {
  const d = await ethClient.readContract({
    address: PKMN_CONTRACT,
    abi: ERC20_ABI,
    functionName: "decimals",
  });
  return Number(d);
}

export async function getTotalSupply(): Promise<bigint> {
  return ethClient.readContract({
    address: PKMN_CONTRACT,
    abi: ERC20_ABI,
    functionName: "totalSupply",
  });
}

export async function getLiveEvolutionLevel(wallet: string): Promise<number> {
  if (!HOOK_CONTRACT) return 1;
  const level = await ethClient.readContract({
    address: HOOK_CONTRACT,
    abi: EVOLUTION_HOOK_ABI,
    functionName: "getLiveLevel",
    args: [wallet as `0x${string}`],
  });
  return Number(level);
}

export async function getEvolutionProgressOnChain(wallet: string): Promise<number> {
  if (!HOOK_CONTRACT) return 0;
  const bps = await ethClient.readContract({
    address: HOOK_CONTRACT,
    abi: EVOLUTION_HOOK_ABI,
    functionName: "evolutionProgress",
    args: [wallet as `0x${string}`],
  });
  return Number(bps) / 100;
}

export async function getCurrentRound() {
  if (!VAULT_CONTRACT) return null;
  const roundId = await ethClient.readContract({
    address: VAULT_CONTRACT,
    abi: VAULT_ABI,
    functionName: "currentRoundId",
  });
  const round = await ethClient.readContract({
    address: VAULT_CONTRACT,
    abi: VAULT_ABI,
    functionName: "rounds",
    args: [roundId],
  });
  return { roundId, ...round };
}
