import { createConfig, http } from "wagmi";
import { avalancheFuji, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [sepolia, avalancheFuji],
  // EIP-6963 discovery lists every installed browser wallet (MetaMask, Core, Rabby, ...).
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || undefined),
    [avalancheFuji.id]: http(
      process.env.NEXT_PUBLIC_FUJI_RPC_URL ||
        "https://api.avax-test.network/ext/bc/C/rpc",
    ),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
