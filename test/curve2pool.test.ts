// Curve2pool
import hardhat from "hardhat";
import { ethers } from "hardhat";
import { expect } from "chai";
import { IERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const USDC = "0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48";
const EURS = "0xdb25f211ab05b1c97d595516f45794528a807ad8"; // 2 decimal
const POOL = "0x98a7f18d4e56cfe84e3d081b40001b3d5bd3eb8b";
const POOL_TOKEN = "0x3d229e1b4faab62f621ef2f6a610961f7bd7b23b";

const WHALE = "0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8";
const EURS_WHALE = "0xe5379345675132653bd303030c6e456034ed1961";

describe("Curve2Pool (USDC - EURS)", () => {
  let usdc: IERC20;
  let eurs: IERC20;
  let poolToken: IERC20;
  let accounts: SignerWithAddress[];

  const deploy = async () => {
    const Curve2Token = await ethers.getContractFactory("Curve2Token");
    const curve2Token = await Curve2Token.connect(accounts[0]).deploy(
      POOL,
      [USDC, EURS],
      POOL_TOKEN,
      100,
      {
        gasLimit: 5_000_000,
      }
    );

    return curve2Token;
  };

  before(async () => {
    await hardhat.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WHALE],
    });

    await hardhat.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [EURS_WHALE],
    });

    const whale = await ethers.getSigner(WHALE);
    const eursWhale = await ethers.getSigner(EURS_WHALE);

    usdc = await ethers.getContractAt("IERC20", USDC);
    eurs = await ethers.getContractAt("IERC20", EURS);
    poolToken = await ethers.getContractAt("IERC20", POOL_TOKEN);

    accounts = await ethers.getSigners();

    const usdcAmount = 1000n * 10n ** 6n; // $1000
    const eursAmount = 1000n * 10n ** 2n; // $1000

    await usdc.connect(whale).transfer(accounts[0].address, usdcAmount);
    await eurs.connect(eursWhale).transfer(accounts[0].address, eursAmount);

    const usdcBalance = await usdc.balanceOf(accounts[0].address);
    const eursBalance = await eurs.balanceOf(accounts[0].address);

    expect(usdcBalance).to.gte(usdcAmount);
    expect(eursBalance).to.gte(eursBalance);
  });

  describe("Add Liquidity", () => {
    it("Adds liquidity only for USDC", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdc = 100n * 10n ** 6n;

      await usdc.connect(accounts[0]).approve(curve.address, hundredUsdc);

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await curve.connect(accounts[0]).addLiquidity([hundredUsdc, 0], 0, 100, {
        value: 100,
      });
      // gasUsed: 390056

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);
    });

    it("Adds liquidity only for EURS", async () => {
      const curve = await loadFixture(deploy);

      const hundredEurs = 100n * 10n ** 2n;

      await eurs.connect(accounts[0]).approve(curve.address, hundredEurs);

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await curve.connect(accounts[0]).addLiquidity([0, hundredEurs], 0, 100, {
        value: 100,
      });
      // gasUsed: 390833

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);
    });

    it("Should add_liquidity for both tokens", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdc = 100n * 10n ** 6n;
      const hundredEurs = 100n * 10n ** 2n;

      await usdc.connect(accounts[0]).approve(curve.address, hundredUsdc);
      await eurs.connect(accounts[0]).approve(curve.address, hundredEurs);

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await curve
        .connect(accounts[0])
        .addLiquidity([hundredUsdc, hundredEurs], 0, 100, {
          value: 100,
        });
      // gasUsed: 472436

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.gt(poolTokenBalanceBefore);
    });
  });

  describe("Remove Liquidity", () => {
    it("Should add_liquidity for 2 tokens and remove_liquidity", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdc = 100n * 10n ** 6n;
      const hundredEurs = 100n * 10n ** 2n;

      await usdc.connect(accounts[0]).approve(curve.address, hundredUsdc);
      await eurs.connect(accounts[0]).approve(curve.address, hundredEurs);

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await curve
        .connect(accounts[0])
        .addLiquidity([hundredUsdc, hundredEurs], 0, 100, {
          value: 100,
        });
      // gasUsed: 472436

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.be.gte(poolTokenBalanceBefore);

      await poolToken
        .connect(accounts[0])
        .approve(curve.address, poolTokenBalanceAfter);

      const usdcBalanceBefore = await usdc.balanceOf(accounts[0].address);
      const eursBalanceBefore = await eurs.balanceOf(accounts[0].address);

      await curve
        .connect(accounts[0])
        .removeLiquidity(poolTokenBalanceAfter, [0, 0], {
          value: 10000,
          gasLimit: 2_000_000,
        });
      // gasUsed: 204446

      const usdcBalanceAfter = await usdc.balanceOf(accounts[0].address);
      const eursBalanceAfter = await eurs.balanceOf(accounts[0].address);

      expect(usdcBalanceAfter).to.be.gt(usdcBalanceBefore);
      expect(eursBalanceAfter).to.be.gt(eursBalanceBefore);
    });

    it("Should add_liquidity for 2 tokens and remove_one_coin", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdc = 100n * 10n ** 6n;
      const hundredEurs = 100n * 10n ** 2n;

      await usdc.connect(accounts[0]).approve(curve.address, hundredUsdc);
      await eurs.connect(accounts[0]).approve(curve.address, hundredEurs);

      const poolTokenBalanceBefore = await poolToken.balanceOf(
        accounts[0].address
      );

      await curve
        .connect(accounts[0])
        .addLiquidity([hundredUsdc, hundredEurs], 0, 100, {
          value: 100,
        });
      // gasUsed: 472436

      const poolTokenBalanceAfter = await poolToken.balanceOf(
        accounts[0].address
      );

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);

      await poolToken
        .connect(accounts[0])
        .approve(curve.address, poolTokenBalanceAfter);

      const eursBalanceBefore = await eurs.balanceOf(accounts[0].address);

      await curve
        .connect(accounts[0])
        .removeLiquidityOneCoinU(poolTokenBalanceAfter, 0, 0, {
          value: 100000,
          gasLimit: 5_000_000,
        });
      // gasUsed: 368702

      const eursBalanceAfter = await eurs.balanceOf(accounts[0].address);

      expect(eursBalanceAfter).to.be.gte(eursBalanceBefore);
    });
  });

  describe("Admin", () => {
    it("Should withdraw money", async () => {
      const curve = await loadFixture(deploy);

      const amount = 10n * 10n ** 18n;

      await accounts[0].sendTransaction({
        to: curve.address,
        value: amount,
      });

      const balanceBefore = await ethers.provider.getBalance(
        accounts[0].address
      );

      await curve.withdrawAdmin();

      const balanceAfter = await ethers.provider.getBalance(
        accounts[0].address
      );

      expect(balanceAfter).to.gt(balanceBefore);
    });
  });
});
