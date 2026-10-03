"use client";

import { useConnect, useConnection, useConnectors, useDisconnect } from "wagmi";

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ConnectWallet() {
  const connection = useConnection();
  const allConnectors = useConnectors();
  // The generic `injected` connector wraps window.ethereum, which is the same
  // wallet that EIP-6963 discovery already lists by name; showing both lets two
  // permission requests race in the wallet's popup.
  const discovered = allConnectors.filter((c) => c.id !== "injected");
  const connectors = discovered.length > 0 ? discovered : allConnectors;
  const connect = useConnect();
  const disconnect = useDisconnect();

  if (connection.isConnected && connection.address) {
    return (
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-zinc-100 px-3 py-1.5 font-mono text-sm dark:bg-zinc-800">
          {shortAddress(connection.address)}
        </span>
        <button
          onClick={() => disconnect.mutate()}
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {(connectors as readonly unknown[]).length === 0 && (
          <span className="text-sm text-zinc-500">
            No browser wallet found. Install MetaMask or Core.
          </span>
        )}
        {connectors.map((connector) => (
          <button
            key={connector.uid}
            onClick={() => connect.mutate({ connector })}
            disabled={connect.isPending}
            className="flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {connector.icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={connector.icon} alt="" className="h-4 w-4" />
            )}
            {connect.isPending && connect.variables?.connector === connector
              ? "Connecting…"
              : `Connect ${connector.name}`}
          </button>
        ))}
      </div>
      {connect.error && (
        <p className="text-sm text-red-600">{connect.error.message}</p>
      )}
    </div>
  );
}
