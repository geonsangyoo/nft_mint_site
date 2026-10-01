# DAppsNft — NFT Mint Site Contracts

Smart contracts for the NFT mint site, built with [Hardhat 3](https://hardhat.org), [viem](https://viem.sh) and [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/5.x/).

## Contract: `DAppsNft`

[`contracts/DAppsNft.sol`](contracts/DAppsNft.sol) is an ERC721 collection (`DAppsNft` / `DNFT`) composed from OpenZeppelin extensions:

| Feature                | Source             | Functions                                                                                  |
| ---------------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| Ownership & transfers  | `ERC721`           | `balanceOf`, `ownerOf`, `transferFrom`, `safeTransferFrom`, `approve`, `setApprovalForAll` |
| Per-token metadata URI | `ERC721URIStorage` | `tokenURI`                                                                                 |
| Emergency pause        | `ERC721Pausable`   | `pause`, `unpause`, `paused` (`PAUSER_ROLE` only)                                          |
| Burning                | `ERC721Burnable`   | `burn` (owner or approved)                                                                 |
| Roles                  | `AccessControl`    | `grantRole`, `revokeRole`, `hasRole`                                                       |

- **Minting:** `safeMint(to, uri)` mints the next sequential token ID (starting at `0`) and stores its metadata URI. **Anyone can mint.** This is intentional for this test contract; add a `MINTER_ROLE` before using it in production.
- **Token ID:** `safeMint` does not return the ID. Read it from the `Transfer(0x0, to, tokenId)` event in the transaction receipt.
- **Roles:** the constructor grants `DEFAULT_ADMIN_ROLE` to `defaultAdmin` and `PAUSER_ROLE` to `pauser`. When paused, minting, transfers and burns all revert.

## Project layout

```text
contracts/          Solidity sources
test/               TypeScript integration tests (node:test + viem)
ignition/modules/   Hardhat Ignition deployment modules
scripts/            Standalone scripts run with `hardhat run`
hardhat.config.ts   Compiler profiles, networks, verification
```

## Setup

This project uses [bun](https://bun.sh) only (no npm/yarn/pnpm).

```shell
bun install
```

## Development

| Command                 | Description                           |
| ----------------------- | ------------------------------------- |
| `bun run build`         | Compile contracts                     |
| `bun run test`          | Run all tests (Solidity + TypeScript) |
| `bun run test:solidity` | Run Solidity tests only               |
| `bun run test:nodejs`   | Run TypeScript tests only             |
| `bun run typecheck`     | Compile, then type-check TypeScript   |
| `bun run format`        | Format all files with Prettier        |
| `bun run format:check`  | Check formatting without writing      |

Formatting uses Prettier with `prettier-plugin-solidity`. VS Code formats Solidity and TypeScript on save once the recommended Prettier extension is installed (see [`.vscode/`](.vscode/)).

Contracts compile with solc `0.8.34` targeting the **`cancun`** EVM, because Avalanche C-Chain may not support newer opcodes. Deployments use the `production` profile (optimizer enabled, 200 runs).

## Deployment

Deployment is done with [Hardhat Ignition](https://hardhat.org/ignition) using [`ignition/modules/DAppsNft.ts`](ignition/modules/DAppsNft.ts).

| Command                  | Network                                          | Chain ID |
| ------------------------ | ------------------------------------------------ | -------- |
| `bun run deploy:local`   | In-process simulated chain (state is discarded)  | 31337    |
| `bun run deploy:sepolia` | Ethereum Sepolia, then verify on Etherscan       | 11155111 |
| `bun run deploy:fuji`    | Avalanche Fuji C-Chain, then verify on Snowtrace | 43113    |

### 1. Set secrets

Secrets are read as Hardhat configuration variables. Store them in the encrypted keystore (recommended) or set them as environment variables:

```shell
bunx hardhat keystore set SEPOLIA_RPC_URL       # Sepolia only
bunx hardhat keystore set SEPOLIA_PRIVATE_KEY   # Sepolia only
bunx hardhat keystore set FUJI_PRIVATE_KEY      # Fuji only
bunx hardhat keystore set ETHERSCAN_API_KEY     # contract verification
```

Fuji uses the public RPC endpoint `https://api.avax-test.network/ext/bc/C/rpc`, so it needs no RPC URL variable.

### 2. Fund the deployer

- Sepolia ETH: any Sepolia faucet
- Fuji AVAX: [Core testnet faucet](https://core.app/tools/testnet-faucet)

### 3. Deploy

```shell
bun run deploy:sepolia
bun run deploy:fuji
```

By default, the deploying account becomes both `defaultAdmin` and `pauser`. To use other addresses (e.g. a multisig), create a parameters file:

```json
{
  "DAppsNftModule": {
    "defaultAdmin": "0x...",
    "pauser": "0x..."
  }
}
```

and pass it to the deploy:

```shell
bunx hardhat ignition deploy ignition/modules/DAppsNft.ts --network fuji --parameters ignition/parameters.fuji.json --verify
```

> Double-check these addresses. Roles are granted only once, in the constructor. If `defaultAdmin` is wrong or `0x0`, the admin role cannot be recovered.

### Deployment records

Ignition writes each deployment to `ignition/deployments/chain-<chainId>/`. The deployed address is in `deployed_addresses.json`. Commit this directory: it lets Ignition resume and skip work that's already done, and it records the official contract address.

### Verification

`--verify` verifies the source through the Etherscan API, using `ETHERSCAN_API_KEY` for both Sepolia (Etherscan) and Fuji (Snowtrace). Etherscan's free API plan may not cover Avalanche. If verification fails with an access error, the contract is still deployed. Retry with a paid key, or verify manually on Snowtrace.
