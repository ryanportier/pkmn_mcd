// Ethereum Mainnet — migrated from Base
const ALCHEMY_ETH_URL = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// Ethereum ~12s block time
const BLOCKS_PER_HOUR = 300;
const BLOCKS_PER_DAY  = 7_200;

async function rpc(method: string, params: unknown[]) {
  const res = await fetch(ALCHEMY_ETH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`Alchemy RPC error: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`RPC error: ${data.error.message}`);
  return data.result;
}

export async function getAllHolders(
  contractAddress: string,
  lookback: "1h" | "1d" | "7d" = "1d"
): Promise<{ address: string; rawBalance: string }[]> {
  const lookbackBlocks =
    lookback === "1h" ? BLOCKS_PER_HOUR :
    lookback === "1d" ? BLOCKS_PER_DAY  :
    BLOCKS_PER_DAY * 7;

  console.log(`📡 Scanning Transfer logs on Ethereum mainnet (last ${lookback})...`);

  const latestHex: string = await rpc("eth_blockNumber", []);
  const latest    = parseInt(latestHex, 16);
  const fromBlock = Math.max(0, latest - lookbackBlocks);

  const CHUNK = 2_000; // Ethereum nodes prefer smaller chunks than Base
  const addressSet = new Set<string>();

  for (let start = fromBlock; start < latest; start += CHUNK) {
    const end = Math.min(start + CHUNK - 1, latest);
    const logs = await rpc("eth_getLogs", [{
      address: contractAddress,
      topics:  [TRANSFER_TOPIC],
      fromBlock: `0x${start.toString(16)}`,
      toBlock:   `0x${end.toString(16)}`,
    }]);

    for (const log of logs) {
      if (log.topics?.[2]) {
        const addr = "0x" + log.topics[2].slice(26).toLowerCase();
        if (addr !== "0x0000000000000000000000000000000000000000") {
          addressSet.add(addr);
        }
      }
    }
  }

  console.log(`📋 ${addressSet.size} unique addresses found, checking balances...`);

  const addresses = Array.from(addressSet);
  const holders: { address: string; rawBalance: string }[] = [];
  const BATCH = 50;

  for (let i = 0; i < addresses.length; i += BATCH) {
    const batch    = addresses.slice(i, i + BATCH);
    const balances = await Promise.all(
      batch.map((addr) => getWalletTokenBalance(addr, contractAddress))
    );
    for (let j = 0; j < batch.length; j++) {
      if (BigInt(balances[j]) > BigInt(0)) {
        holders.push({ address: batch[j], rawBalance: balances[j] });
      }
    }
  }

  console.log(`✅ ${holders.length} active holders`);
  return holders;
}

export async function getWalletTokenBalance(
  wallet: string,
  contractAddress: string
): Promise<string> {
  const data =
    "0x70a08231" + wallet.toLowerCase().replace("0x", "").padStart(64, "0");
  const result = await rpc("eth_call", [{ to: contractAddress, data }, "latest"]);
  return result ?? "0x0";
}

export async function getEthBalance(wallet: string): Promise<string> {
  const result = await rpc("eth_getBalance", [wallet, "latest"]);
  return result ?? "0x0";
}

// WETH on Ethereum mainnet
const WETH_MAINNET = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

export async function getVaultWalletInfo(
  vaultWallet: string,
  tokenContract: string
): Promise<{
  eth_balance_wei: string;
  eth_balance: number;
  weth_balance: number;
  total_eth_value: number;
  token_balance_raw: string;
  token_balance: number;
}> {
  const [ethRaw, wethRaw, tokenRaw] = await Promise.all([
    getEthBalance(vaultWallet),
    getWalletTokenBalance(vaultWallet, WETH_MAINNET),
    getWalletTokenBalance(vaultWallet, tokenContract),
  ]);

  const eth_balance   = Number(BigInt(ethRaw))   / 1e18;
  const weth_balance  = Number(BigInt(wethRaw))  / 1e18;
  const token_balance = Number(BigInt(tokenRaw)) / 1e18;

  return {
    eth_balance_wei:  ethRaw,
    eth_balance,
    weth_balance,
    total_eth_value:  eth_balance + weth_balance,
    token_balance_raw: tokenRaw,
    token_balance,
  };
}
