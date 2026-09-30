import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress, keccak256, toHex, zeroAddress, zeroHash } from "viem";

const PAUSER_ROLE = keccak256(toHex("PAUSER_ROLE"));
const TOKEN_URI = "ipfs://token-0";

describe("DAppsNft", async function () {
  const { viem, networkHelpers } = await network.create();
  const [admin, pauser, alice, bob] = await viem.getWalletClients();

  async function deployDAppsNftFixture() {
    const nft = await viem.deployContract("DAppsNft", [
      admin.account.address,
      pauser.account.address,
    ]);
    return { nft };
  }

  async function mintedFixture() {
    const { nft } = await deployDAppsNftFixture();
    await nft.write.safeMint([alice.account.address, TOKEN_URI]);
    return { nft };
  }

  describe("Deployment", function () {
    it("sets name and symbol", async function () {
      const { nft } = await networkHelpers.loadFixture(deployDAppsNftFixture);

      assert.equal(await nft.read.name(), "DAppsNft");
      assert.equal(await nft.read.symbol(), "DNFT");
    });

    it("grants DEFAULT_ADMIN_ROLE to the admin and PAUSER_ROLE to the pauser", async function () {
      const { nft } = await networkHelpers.loadFixture(deployDAppsNftFixture);

      assert.equal(await nft.read.DEFAULT_ADMIN_ROLE(), zeroHash);
      assert.equal(await nft.read.PAUSER_ROLE(), PAUSER_ROLE);
      assert.equal(
        await nft.read.hasRole([zeroHash, admin.account.address]),
        true,
      );
      assert.equal(
        await nft.read.hasRole([PAUSER_ROLE, pauser.account.address]),
        true,
      );
    });

    it("does not cross-grant roles", async function () {
      const { nft } = await networkHelpers.loadFixture(deployDAppsNftFixture);

      assert.equal(
        await nft.read.hasRole([PAUSER_ROLE, admin.account.address]),
        false,
      );
      assert.equal(
        await nft.read.hasRole([zeroHash, pauser.account.address]),
        false,
      );
    });

    it("starts unpaused with no tokens", async function () {
      const { nft } = await networkHelpers.loadFixture(deployDAppsNftFixture);

      assert.equal(await nft.read.paused(), false);
      assert.equal(await nft.read.balanceOf([alice.account.address]), 0n);
    });
  });

  describe("Minting", function () {
    it("mints to the recipient and sets the token URI", async function () {
      const { nft } = await networkHelpers.loadFixture(mintedFixture);

      assert.equal(
        await nft.read.ownerOf([0n]),
        getAddress(alice.account.address),
      );
      assert.equal(await nft.read.balanceOf([alice.account.address]), 1n);
      assert.equal(await nft.read.tokenURI([0n]), TOKEN_URI);
    });

    it("assigns sequential token ids starting at 0", async function () {
      const { nft } = await networkHelpers.loadFixture(deployDAppsNftFixture);

      await nft.write.safeMint([alice.account.address, "ipfs://a"]);
      await nft.write.safeMint([bob.account.address, "ipfs://b"]);
      await nft.write.safeMint([alice.account.address, "ipfs://c"]);

      assert.equal(
        await nft.read.ownerOf([0n]),
        getAddress(alice.account.address),
      );
      assert.equal(
        await nft.read.ownerOf([1n]),
        getAddress(bob.account.address),
      );
      assert.equal(
        await nft.read.ownerOf([2n]),
        getAddress(alice.account.address),
      );
      assert.equal(await nft.read.tokenURI([1n]), "ipfs://b");
      assert.equal(await nft.read.balanceOf([alice.account.address]), 2n);
    });

    it("emits Transfer and MetadataUpdate", async function () {
      const { nft } = await networkHelpers.loadFixture(deployDAppsNftFixture);

      await viem.assertions.emitWithArgs(
        nft.write.safeMint([alice.account.address, TOKEN_URI]),
        nft,
        "Transfer",
        [zeroAddress, getAddress(alice.account.address), 0n],
      );
      await viem.assertions.emitWithArgs(
        nft.write.safeMint([alice.account.address, TOKEN_URI]),
        nft,
        "MetadataUpdate",
        [1n],
      );
    });

    it("is open to any account (no minter role)", async function () {
      const { nft } = await networkHelpers.loadFixture(deployDAppsNftFixture);

      await nft.write.safeMint([bob.account.address, TOKEN_URI], {
        account: bob.account,
      });

      assert.equal(
        await nft.read.ownerOf([0n]),
        getAddress(bob.account.address),
      );
    });

    it("reverts when minting to the zero address", async function () {
      const { nft } = await networkHelpers.loadFixture(deployDAppsNftFixture);

      await viem.assertions.revertWithCustomErrorWithArgs(
        nft.write.safeMint([zeroAddress, TOKEN_URI]),
        nft,
        "ERC721InvalidReceiver",
        [zeroAddress],
      );
    });

    it("reverts when minting to a contract that is not an ERC721 receiver", async function () {
      const { nft } = await networkHelpers.loadFixture(deployDAppsNftFixture);

      // DAppsNft itself does not implement IERC721Receiver.
      await viem.assertions.revertWithCustomErrorWithArgs(
        nft.write.safeMint([nft.address, TOKEN_URI]),
        nft,
        "ERC721InvalidReceiver",
        [getAddress(nft.address)],
      );
    });

    it("reverts tokenURI for a nonexistent token", async function () {
      const { nft } = await networkHelpers.loadFixture(deployDAppsNftFixture);

      await viem.assertions.revertWithCustomErrorWithArgs(
        nft.read.tokenURI([0n]),
        nft,
        "ERC721NonexistentToken",
        [0n],
      );
    });
  });

  describe("Pausing", function () {
    it("lets the pauser pause and unpause", async function () {
      const { nft } = await networkHelpers.loadFixture(deployDAppsNftFixture);

      await viem.assertions.emitWithArgs(
        nft.write.pause({ account: pauser.account }),
        nft,
        "Paused",
        [getAddress(pauser.account.address)],
      );
      assert.equal(await nft.read.paused(), true);

      await viem.assertions.emitWithArgs(
        nft.write.unpause({ account: pauser.account }),
        nft,
        "Unpaused",
        [getAddress(pauser.account.address)],
      );
      assert.equal(await nft.read.paused(), false);
    });

    it("rejects pause and unpause from accounts without PAUSER_ROLE", async function () {
      const { nft } = await networkHelpers.loadFixture(deployDAppsNftFixture);

      // Even the admin cannot pause without being granted PAUSER_ROLE.
      for (const account of [admin, alice]) {
        await viem.assertions.revertWithCustomErrorWithArgs(
          nft.write.pause({ account: account.account }),
          nft,
          "AccessControlUnauthorizedAccount",
          [getAddress(account.account.address), PAUSER_ROLE],
        );
      }

      await nft.write.pause({ account: pauser.account });
      await viem.assertions.revertWithCustomErrorWithArgs(
        nft.write.unpause({ account: alice.account }),
        nft,
        "AccessControlUnauthorizedAccount",
        [getAddress(alice.account.address), PAUSER_ROLE],
      );
    });

    it("reverts pause when already paused and unpause when not paused", async function () {
      const { nft } = await networkHelpers.loadFixture(deployDAppsNftFixture);

      await viem.assertions.revertWithCustomError(
        nft.write.unpause({ account: pauser.account }),
        nft,
        "ExpectedPause",
      );

      await nft.write.pause({ account: pauser.account });
      await viem.assertions.revertWithCustomError(
        nft.write.pause({ account: pauser.account }),
        nft,
        "EnforcedPause",
      );
    });

    it("blocks minting, transfers and burning while paused", async function () {
      const { nft } = await networkHelpers.loadFixture(mintedFixture);
      await nft.write.pause({ account: pauser.account });

      await viem.assertions.revertWithCustomError(
        nft.write.safeMint([alice.account.address, TOKEN_URI]),
        nft,
        "EnforcedPause",
      );
      await viem.assertions.revertWithCustomError(
        nft.write.transferFrom(
          [alice.account.address, bob.account.address, 0n],
          { account: alice.account },
        ),
        nft,
        "EnforcedPause",
      );
      await viem.assertions.revertWithCustomError(
        nft.write.burn([0n], { account: alice.account }),
        nft,
        "EnforcedPause",
      );
    });

    it("still allows approvals while paused", async function () {
      const { nft } = await networkHelpers.loadFixture(mintedFixture);
      await nft.write.pause({ account: pauser.account });

      await nft.write.approve([bob.account.address, 0n], {
        account: alice.account,
      });

      assert.equal(
        await nft.read.getApproved([0n]),
        getAddress(bob.account.address),
      );
    });

    it("resumes transfers after unpause", async function () {
      const { nft } = await networkHelpers.loadFixture(mintedFixture);
      await nft.write.pause({ account: pauser.account });
      await nft.write.unpause({ account: pauser.account });

      await nft.write.transferFrom(
        [alice.account.address, bob.account.address, 0n],
        { account: alice.account },
      );

      assert.equal(
        await nft.read.ownerOf([0n]),
        getAddress(bob.account.address),
      );
    });
  });

  describe("Transfers", function () {
    it("lets the owner transfer a token", async function () {
      const { nft } = await networkHelpers.loadFixture(mintedFixture);

      await viem.assertions.emitWithArgs(
        nft.write.safeTransferFrom(
          [alice.account.address, bob.account.address, 0n],
          { account: alice.account },
        ),
        nft,
        "Transfer",
        [
          getAddress(alice.account.address),
          getAddress(bob.account.address),
          0n,
        ],
      );

      assert.equal(
        await nft.read.ownerOf([0n]),
        getAddress(bob.account.address),
      );
      assert.equal(await nft.read.tokenURI([0n]), TOKEN_URI);
    });

    it("lets an approved account transfer a token", async function () {
      const { nft } = await networkHelpers.loadFixture(mintedFixture);

      await nft.write.approve([bob.account.address, 0n], {
        account: alice.account,
      });
      await nft.write.transferFrom(
        [alice.account.address, bob.account.address, 0n],
        { account: bob.account },
      );

      assert.equal(
        await nft.read.ownerOf([0n]),
        getAddress(bob.account.address),
      );
    });

    it("rejects transfers by unapproved accounts", async function () {
      const { nft } = await networkHelpers.loadFixture(mintedFixture);

      await viem.assertions.revertWithCustomErrorWithArgs(
        nft.write.transferFrom(
          [alice.account.address, bob.account.address, 0n],
          { account: bob.account },
        ),
        nft,
        "ERC721InsufficientApproval",
        [getAddress(bob.account.address), 0n],
      );
    });
  });

  describe("Burning", function () {
    it("lets the owner burn a token", async function () {
      const { nft } = await networkHelpers.loadFixture(mintedFixture);

      await viem.assertions.emitWithArgs(
        nft.write.burn([0n], { account: alice.account }),
        nft,
        "Transfer",
        [getAddress(alice.account.address), zeroAddress, 0n],
      );

      assert.equal(await nft.read.balanceOf([alice.account.address]), 0n);
      await viem.assertions.revertWithCustomErrorWithArgs(
        nft.read.ownerOf([0n]),
        nft,
        "ERC721NonexistentToken",
        [0n],
      );
      await viem.assertions.revertWithCustomErrorWithArgs(
        nft.read.tokenURI([0n]),
        nft,
        "ERC721NonexistentToken",
        [0n],
      );
    });

    it("lets an approved operator burn a token", async function () {
      const { nft } = await networkHelpers.loadFixture(mintedFixture);

      await nft.write.setApprovalForAll([bob.account.address, true], {
        account: alice.account,
      });
      await nft.write.burn([0n], { account: bob.account });

      assert.equal(await nft.read.balanceOf([alice.account.address]), 0n);
    });

    it("rejects burning by unapproved accounts", async function () {
      const { nft } = await networkHelpers.loadFixture(mintedFixture);

      await viem.assertions.revertWithCustomErrorWithArgs(
        nft.write.burn([0n], { account: bob.account }),
        nft,
        "ERC721InsufficientApproval",
        [getAddress(bob.account.address), 0n],
      );
    });

    it("does not reuse burned token ids", async function () {
      const { nft } = await networkHelpers.loadFixture(mintedFixture);

      await nft.write.burn([0n], { account: alice.account });
      await nft.write.safeMint([bob.account.address, "ipfs://next"]);

      assert.equal(
        await nft.read.ownerOf([1n]),
        getAddress(bob.account.address),
      );
    });
  });

  describe("Access control", function () {
    it("lets the admin grant and revoke PAUSER_ROLE", async function () {
      const { nft } = await networkHelpers.loadFixture(deployDAppsNftFixture);

      await nft.write.grantRole([PAUSER_ROLE, alice.account.address], {
        account: admin.account,
      });
      await nft.write.pause({ account: alice.account });
      assert.equal(await nft.read.paused(), true);

      await nft.write.revokeRole([PAUSER_ROLE, alice.account.address], {
        account: admin.account,
      });
      await viem.assertions.revertWithCustomErrorWithArgs(
        nft.write.unpause({ account: alice.account }),
        nft,
        "AccessControlUnauthorizedAccount",
        [getAddress(alice.account.address), PAUSER_ROLE],
      );
    });

    it("rejects role grants from non-admins", async function () {
      const { nft } = await networkHelpers.loadFixture(deployDAppsNftFixture);

      await viem.assertions.revertWithCustomErrorWithArgs(
        nft.write.grantRole([PAUSER_ROLE, alice.account.address], {
          account: pauser.account,
        }),
        nft,
        "AccessControlUnauthorizedAccount",
        [getAddress(pauser.account.address), zeroHash],
      );
    });
  });

  describe("supportsInterface", function () {
    it("supports ERC165, ERC721, ERC721Metadata, ERC4906 and AccessControl", async function () {
      const { nft } = await networkHelpers.loadFixture(deployDAppsNftFixture);

      for (const id of [
        "0x01ffc9a7", // ERC165
        "0x80ac58cd", // ERC721
        "0x5b5e139f", // ERC721Metadata
        "0x49064906", // ERC4906
        "0x7965db0b", // IAccessControl
      ] as const) {
        assert.equal(await nft.read.supportsInterface([id]), true, id);
      }
    });

    it("rejects unknown interfaces", async function () {
      const { nft } = await networkHelpers.loadFixture(deployDAppsNftFixture);

      assert.equal(await nft.read.supportsInterface(["0xffffffff"]), false);
    });
  });
});
