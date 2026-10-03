import { ConnectWallet } from "@/components/ConnectWallet";
import { MintPanel } from "@/components/MintPanel";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <span className="text-lg font-semibold tracking-tight">DAppsNft</span>
        <ConnectWallet />
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-16 pt-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          Mint a DAppsNft
        </h1>
        <p className="mt-2 text-zinc-500">
          Mint on Ethereum Sepolia or Avalanche Fuji. Each mint gets the next
          token ID and its metadata URI is stored on-chain.
        </p>
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">
          <MintPanel />
        </section>
      </main>
    </div>
  );
}
