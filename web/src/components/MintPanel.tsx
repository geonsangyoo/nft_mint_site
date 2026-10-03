"use client";

import { useEffect, useState } from "react";
import { BaseError, parseEventLogs } from "viem";
import {
  useChains,
  useConnection,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { dAppsNftAbi, dAppsNftAddress } from "@/lib/contract";
import type { config } from "@/lib/wagmi";
import { shortAddress } from "./ConnectWallet";

type MetadataMode = "build" | "uri";
type ChainId = (typeof config)["chains"][number]["id"];

// Metadata is stored on-chain as a data: URI so minting needs no IPFS upload.
function toDataUri(metadata: {
  name: string;
  description: string;
  image: string;
}) {
  const bytes = new TextEncoder().encode(JSON.stringify(metadata));
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return `data:application/json;base64,${btoa(binary)}`;
}

function errorMessage(error: Error) {
  return error instanceof BaseError ? error.shortMessage : error.message;
}

export function MintPanel() {
  const chains = useChains();
  const connection = useConnection();
  const switchChain = useSwitchChain();
  const write = useWriteContract();

  // Until the user picks a network, follow the wallet if it is on a supported chain.
  const [selectedChainId, setChainId] = useState<ChainId>();
  const walletChain = chains.find((c) => c.id === connection.chainId);
  const chainId = selectedChainId ?? walletChain?.id ?? chains[0].id;
  const chain = chains.find((c) => c.id === chainId)!;
  const contract = dAppsNftAddress[chainId];
  const explorer = chain.blockExplorers?.default.url;

  const [mode, setMode] = useState<MetadataMode>("build");
  const [name, setName] = useState("DAppsNft #");
  const [description, setDescription] = useState(
    "Minted from the DAppsNft mint site",
  );
  const [image, setImage] = useState("");
  const [uri, setUri] = useState("");
  const tokenUri =
    mode === "build" ? toDataUri({ name, description, image }) : uri;

  const reads = useReadContracts({
    contracts: [
      { address: contract, abi: dAppsNftAbi, functionName: "name", chainId },
      { address: contract, abi: dAppsNftAbi, functionName: "paused", chainId },
    ],
  });
  const [collectionName, paused] = reads.data ?? [];
  const balance = useReadContract({
    address: contract,
    abi: dAppsNftAbi,
    functionName: "balanceOf",
    args: connection.address ? [connection.address] : undefined,
    chainId,
    query: { enabled: !!connection.address },
  });

  const [submittedAt, setSubmittedAt] = useState(0);
  const receipt = useWaitForTransactionReceipt({
    hash: write.data,
    chainId,
    pollingInterval: 500,
  });
  const mintedTokenId = receipt.data
    ? parseEventLogs({
        abi: dAppsNftAbi,
        eventName: "Transfer",
        logs: receipt.data.logs,
      })[0]?.args.tokenId
    : undefined;

  const elapsed = receipt.isSuccess
    ? (receipt.dataUpdatedAt - submittedAt) / 1000
    : undefined;

  const refetchBalance = balance.refetch;
  useEffect(() => {
    if (receipt.isSuccess) refetchBalance();
  }, [receipt.isSuccess, refetchBalance]);

  const address = connection.isConnected ? connection.address : undefined;
  const onWrongChain = !!address && connection.chainId !== chainId;
  const busy = write.isPending || (write.isSuccess && receipt.isLoading);

  function mint() {
    if (!address) return;
    setSubmittedAt(Date.now());
    write.mutate({
      address: contract,
      abi: dAppsNftAbi,
      functionName: "safeMint",
      args: [address, tokenUri],
      chainId,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Network */}
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
        {chains.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setChainId(c.id);
              write.reset();
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              c.id === chainId
                ? "bg-white shadow-sm dark:bg-zinc-700"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Collection */}
      <dl className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <dt className="text-zinc-500">Collection</dt>
          <dd className="font-medium">{collectionName?.result ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Status</dt>
          <dd className="font-medium">
            {paused?.result === undefined
              ? "—"
              : paused.result
                ? "Paused"
                : "Live"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">You own</dt>
          <dd className="font-medium">
            {address && balance.data !== undefined
              ? `${balance.data} NFT`
              : "—"}
          </dd>
        </div>
        <div className="col-span-3">
          <dt className="text-zinc-500">Contract</dt>
          <dd>
            <a
              href={`${explorer}/address/${contract}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-blue-600 hover:underline dark:text-blue-400"
            >
              {contract}
            </a>
          </dd>
        </div>
      </dl>

      {/* Metadata */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-4 text-sm">
          {(["build", "uri"] as const).map((m) => (
            <label key={m} className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={mode === m}
                onChange={() => setMode(m)}
              />
              {m === "build" ? "Build metadata" : "Use existing token URI"}
            </label>
          ))}
        </div>
        {mode === "build" ? (
          <>
            <Field label="Name" value={name} onChange={setName} />
            <Field
              label="Description"
              value={description}
              onChange={setDescription}
            />
            <Field
              label="Image URL"
              value={image}
              onChange={setImage}
              placeholder="https://… or ipfs://…"
            />
          </>
        ) : (
          <Field
            label="Token URI"
            value={uri}
            onChange={setUri}
            placeholder="ipfs://…/metadata.json"
          />
        )}
      </div>

      {/* Action */}
      {!address ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Connect a wallet to mint.
        </p>
      ) : onWrongChain ? (
        <button
          onClick={() => switchChain.mutate({ chainId })}
          disabled={switchChain.isPending}
          className="rounded-xl bg-amber-500 px-4 py-3 font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
        >
          {switchChain.isPending
            ? "Switching…"
            : `Switch wallet to ${chain.name}`}
        </button>
      ) : (
        <button
          onClick={mint}
          disabled={busy || paused?.result === true || !tokenUri}
          className="rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {write.isPending
            ? "Confirm in wallet…"
            : busy
              ? "Waiting for block…"
              : `Mint to ${shortAddress(address)}`}
        </button>
      )}

      {/* Result */}
      {(write.error ?? switchChain.error ?? receipt.error) && (
        <p className="text-sm text-red-600">
          {errorMessage((write.error ?? switchChain.error ?? receipt.error)!)}
        </p>
      )}
      {write.data && (
        <div className="rounded-xl bg-zinc-50 p-4 text-sm dark:bg-zinc-900">
          <p>
            Tx{" "}
            <a
              href={`${explorer}/tx/${write.data}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-blue-600 hover:underline dark:text-blue-400"
            >
              {shortAddress(write.data)}
            </a>{" "}
            {receipt.isSuccess
              ? receipt.data.status === "success"
                ? "confirmed"
                : "reverted"
              : "pending…"}
          </p>
          {receipt.isSuccess && receipt.data.status === "success" && (
            <p className="mt-1">
              Minted token <strong>#{mintedTokenId?.toString()}</strong> in
              block {receipt.data.blockNumber.toString()}
              {elapsed !== undefined &&
                ` · ${elapsed.toFixed(1)}s from wallet prompt to block`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-500">{props.label}</span>
      <input
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
      />
    </label>
  );
}
