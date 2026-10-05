// Sends the transfers used to compare Sepolia and Avalanche Fuji, and
// measures submit -> inclusion -> finality time and the fee paid for each.
//
//   bunx hardhat run scripts/compare-transfers.ts            # every step
//   STEP=sepolia bunx hardhat run scripts/compare-transfers.ts
//   STEP=fuji    bunx hardhat run scripts/compare-transfers.ts
//   STEP=c2p     bunx hardhat run scripts/compare-transfers.ts
//   STEP=fuji,c2p bunx hardhat run scripts/compare-transfers.ts
//   STEP=sepolia-eth,fuji-jpyc bunx hardhat run scripts/compare-transfers.ts
//
// Sepolia finality takes ~13-15 min, so it is only awaited with WAIT_FINALITY=1.
import hre, { network } from "hardhat";
import {
  erc20Abi,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
} from "viem";

// avalanchejs ships extensionless relative imports in its .d.ts files, which
// TypeScript cannot resolve under `module: node20`; the runtime ESM bundle is fine.
const { Context, addTxSignatures, evm, pvm, utils }: any =
  await import("@avalabs/avalanchejs");

const RECIPIENT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const P_CHAIN_RECIPIENT = "P-fuji1sx5pazvmqthdzc2y3cwm6pwerze3vg8ccp0zuu";
const JPYC = "0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29";
const AVAX_API = "https://api.avax-test.network";

const steps = (process.env.STEP ?? "all").split(",");
const runs = (name: string) => steps.includes("all") || steps.includes(name);
const now = () => performance.now();
const secs = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sepoliaJpyc() {
  const { viem } = await network.create("sepolia");
  const publicClient = await viem.getPublicClient();
  const [wallet] = await viem.getWalletClients();

  console.log("\n=== Sepolia: JPYC 10 (ERC-20 transfer) ===");
  const t0 = now();
  const hash = await wallet.writeContract({
    address: JPYC,
    abi: erc20Abi,
    functionName: "transfer",
    args: [RECIPIENT, parseUnits("10", 18)],
  });
  const tSent = now();
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    pollingInterval: 1_000,
  });
  const tIncluded = now();
  console.log(`tx       ${hash}`);
  console.log(`block    ${receipt.blockNumber}`);
  console.log(`included ${secs(tIncluded - t0)} after submit`);

  // Finality = the block is at or below the beacon chain's finalized checkpoint.
  if (process.env.WAIT_FINALITY === "1") {
    while (true) {
      const finalized = await publicClient.getBlock({ blockTag: "finalized" });
      if (finalized.number >= receipt.blockNumber) break;
      await sleep(12_000);
    }
    console.log(`final    ${secs(now() - t0)} after submit`);
  }
  const fee = receipt.gasUsed * receipt.effectiveGasPrice;
  console.log(`gasUsed  ${receipt.gasUsed}`);
  console.log(`gasPrice ${formatUnits(receipt.effectiveGasPrice, 9)} gwei`);
  console.log(`fee      ${formatEther(fee)} ETH`);
  console.log(`(rpc send ${secs(tSent - t0)})`);
}

async function sepoliaEth() {
  const { viem } = await network.create("sepolia");
  const publicClient = await viem.getPublicClient();
  const [wallet] = await viem.getWalletClients();

  console.log("\n=== Sepolia: ETH 0.01 (native transfer) ===");
  const t0 = now();
  const hash = await wallet.sendTransaction({
    to: RECIPIENT,
    value: parseEther("0.01"),
  });
  const tSent = now();
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    pollingInterval: 1_000,
  });
  const tIncluded = now();
  console.log(`tx       ${hash}`);
  console.log(`block    ${receipt.blockNumber}`);
  console.log(`included ${secs(tIncluded - t0)} after submit`);

  if (process.env.WAIT_FINALITY === "1") {
    while (true) {
      const finalized = await publicClient.getBlock({ blockTag: "finalized" });
      if (finalized.number >= receipt.blockNumber) break;
      await sleep(12_000);
    }
    console.log(`final    ${secs(now() - t0)} after submit`);
  }
  const fee = receipt.gasUsed * receipt.effectiveGasPrice;
  console.log(`gasUsed  ${receipt.gasUsed}`);
  console.log(`gasPrice ${formatUnits(receipt.effectiveGasPrice, 9)} gwei`);
  console.log(`fee      ${formatEther(fee)} ETH`);
  console.log(`(rpc send ${secs(tSent - t0)})`);
}

async function fujiJpyc() {
  const { viem } = await network.create("fuji");
  const publicClient = await viem.getPublicClient();
  const [wallet] = await viem.getWalletClients();

  // JPYC is deployed at the same address on Sepolia and Fuji.
  const amount = parseUnits("10", 18);
  const balance = await publicClient.readContract({
    address: JPYC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [wallet.account.address],
  });
  if (balance < amount) {
    throw new Error(
      `${wallet.account.address} holds ${formatUnits(balance, 18)} JPYC on Fuji; need at least 10`,
    );
  }

  console.log("\n=== Fuji C-Chain: JPYC 10 (ERC-20 transfer) ===");
  const t0 = now();
  const hash = await wallet.writeContract({
    address: JPYC,
    abi: erc20Abi,
    functionName: "transfer",
    args: [RECIPIENT, amount],
  });
  const tSent = now();
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    pollingInterval: 200,
  });
  const tFinal = now();
  const fee = receipt.gasUsed * receipt.effectiveGasPrice;
  console.log(`tx       ${hash}`);
  console.log(`block    ${receipt.blockNumber}`);
  console.log(`final    ${secs(tFinal - t0)} after submit (accepted = final)`);
  console.log(`gasUsed  ${receipt.gasUsed}`);
  console.log(`gasPrice ${receipt.effectiveGasPrice} wei`);
  console.log(`fee      ${formatEther(fee)} AVAX`);
  console.log(`(rpc send ${secs(tSent - t0)})`);
}

async function fujiAvax() {
  const { viem } = await network.create("fuji");
  const publicClient = await viem.getPublicClient();
  const [wallet] = await viem.getWalletClients();

  console.log("\n=== Fuji C-Chain: AVAX 0.01 (native transfer) ===");
  const t0 = now();
  const hash = await wallet.sendTransaction({
    to: RECIPIENT,
    value: parseEther("0.01"),
  });
  const tSent = now();
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    pollingInterval: 200,
  });
  // Snowman: an accepted block is final; a receipt only exists for accepted blocks.
  const tFinal = now();
  const fee = receipt.gasUsed * receipt.effectiveGasPrice;
  console.log(`tx       ${hash}`);
  console.log(`block    ${receipt.blockNumber}`);
  console.log(`final    ${secs(tFinal - t0)} after submit (accepted = final)`);
  console.log(`gasUsed  ${receipt.gasUsed}`);
  console.log(`gasPrice ${receipt.effectiveGasPrice} wei`);
  console.log(`fee      ${formatEther(fee)} AVAX`);
  console.log(`(rpc send ${secs(tSent - t0)})`);
}

async function fujiCToP() {
  const [account] = hre.config.networks.fuji.accounts as unknown[];
  if (
    account === undefined ||
    !(typeof account === "object" && account !== null && "get" in account)
  ) {
    throw new Error("fuji account must be a configuration variable");
  }
  const privateKey = utils.hexToBuffer(
    await (account as { get(): Promise<string> }).get(),
  );

  const { viem } = await network.create("fuji");
  const publicClient = await viem.getPublicClient();
  const [wallet] = await viem.getWalletClients();
  const from = wallet.account.address;

  const evmApi = new evm.EVMApi(AVAX_API);
  const pvmApi = new pvm.PVMApi(AVAX_API);
  const context = await Context.getContextFromURI(AVAX_API);

  // Atomic tx fees are denominated in nAVAX per gas; the EVM base fee is in wei.
  // Fuji's base fee is currently far below 1 nAVAX, so round up to at least 1.
  const baseFeeWei = await evmApi.getBaseFee();
  const baseFeeNAvax = (baseFeeWei + 999_999_999n) / 1_000_000_000n || 1n;
  const nonce = await publicClient.getTransactionCount({ address: from });
  const amountNAvax = 10_000_000n; // 0.01 AVAX

  console.log("\n=== Fuji C-Chain -> P-Chain: AVAX 0.01 (ExportTx) ===");
  const unsignedTx = evm.newExportTxFromBaseFee(
    context,
    baseFeeNAvax,
    amountNAvax,
    context.pBlockchainID,
    utils.hexToBuffer(from),
    [utils.bech32ToBytes(P_CHAIN_RECIPIENT)],
    BigInt(nonce),
  );
  await addTxSignatures({ unsignedTx, privateKeys: [privateKey] });
  const fee = evm.estimateExportCost(
    context,
    baseFeeNAvax,
    amountNAvax,
    context.pBlockchainID,
    utils.hexToBuffer(from),
    [utils.bech32ToBytes(P_CHAIN_RECIPIENT)],
    BigInt(nonce),
  );

  const t0 = now();
  const { txID } = await evmApi.issueSignedTx(unsignedTx.getSignedTx());
  // avax.getAtomicTxStatus is disabled on the public API (avalanchego 1.15), so
  // poll avax.getAtomicTx: it returns a blockHeight once the tx is accepted.
  while (true) {
    const res = await fetch(`${AVAX_API}/ext/bc/C/avax`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "avax.getAtomicTx",
        params: { txID, encoding: "hex" },
      }),
    });
    const { result } = (await res.json()) as {
      result?: { blockHeight?: string };
    };
    if (result?.blockHeight !== undefined) break;
    await sleep(200);
  }
  const tAccepted = now();

  // The exported UTXO sits in shared memory until the P-Chain owner imports it.
  while (true) {
    const { utxos }: { utxos: any[] } = await pvmApi.getUTXOs({
      addresses: [P_CHAIN_RECIPIENT],
      sourceChain: "C",
    });
    if (utxos.some((u: any) => u.utxoId.txID.toString() === txID)) break;
    await sleep(200);
  }
  const tImportable = now();

  console.log(`txID       ${txID}`);
  console.log(
    `accepted   ${secs(tAccepted - t0)} after submit (C-Chain final)`,
  );
  console.log(
    `importable ${secs(tImportable - t0)} after submit (P-Chain shared memory)`,
  );
  console.log(
    `fee        ${formatUnits(fee, 9)} AVAX (${fee} nAVAX @ ${baseFeeNAvax} nAVAX/gas)`,
  );
  console.log(
    `note: ${P_CHAIN_RECIPIENT} must sign the P-Chain ImportTx to receive the funds`,
  );
}

if (runs("sepolia")) await sepoliaJpyc();
if (runs("sepolia-eth")) await sepoliaEth();
if (runs("fuji")) await fujiAvax();
if (runs("fuji-jpyc")) await fujiJpyc();
if (runs("c2p")) await fujiCToP();
