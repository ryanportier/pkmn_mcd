import { createPublicClient, http, parseAbi } from "viem";
import { base } from "viem/chains";

export const baseClient = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC),
});

export const PKMN_CONTRACT = process.env
  .NEXT_PUBLIC_PKMN_CONTRACT as `0x${string}`;

export const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
]);

export async function getTokenBalance(wallet: string): Promise<bigint> {
  return baseClient.readContract({
    address: PKMN_CONTRACT,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [wallet as `0x${string}`],
  });
}

export async function getTokenDecimals(): Promise<number> {
  const d = await baseClient.readContract({
    address: PKMN_CONTRACT,
    abi: ERC20_ABI,
    functionName: "decimals",
  });
  return Number(d);
}

export async function getTotalSupply(): Promise<bigint> {
  return baseClient.readContract({
    address: PKMN_CONTRACT,
    abi: ERC20_ABI,
    functionName: "totalSupply",
  });
}
