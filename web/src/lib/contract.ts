import { parseAbi, type Address } from "viem";
import { avalancheFuji, sepolia } from "wagmi/chains";

export const dAppsNftAbi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function paused() view returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function safeMint(address to, string uri)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);

export const dAppsNftAddress: Record<number, Address> = {
  [sepolia.id]: "0x7c7C5211123faE362f6e253Fd55dB7a3C404dc7e",
  [avalancheFuji.id]: "0xEa8508741fC3459cC4d7408AF5D91eCa0b400844",
};
