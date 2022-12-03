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

    expect(usdcBalance).to.equal(usdcAmount);
    expect(eursBalance).to.equal(eursBalance);
  });

  describe("Add Liquidity", () => {
    it("Adds liquidity only for USDC", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdc = 100n * 10n ** 6n;

      await usdc.connect(accounts[0]).approve(curve.address, hundredUsdc);

      await curve.connect(accounts[0]).addLiquidity([hundredUsdc, 0], 0, {
        value: 100,
      });
      // gasUsed: 240k
    });

    it("Adds liquidity only for EURS", async () => {
      const curve = await loadFixture(deploy);

      const hundredEurs = 100n * 10n ** 2n;

      await eurs.connect(accounts[0]).approve(curve.address, hundredEurs);

      await curve.connect(accounts[0]).addLiquidity([0, hundredEurs], 0, {
        value: 100,
      });
      // gasUsed: 240k
    });
  });

  describe("Remove Liquidity", () => {
    it("Should add_liquidity for 2 tokens and remove_liquidity", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdc = 100n * 10n ** 6n;
      const hundredEurs = 100n * 10n ** 2n;

      await usdc.connect(accounts[0]).approve(curve.address, hundredUsdc);
      await eurs.connect(accounts[0]).approve(curve.address, hundredEurs);

      await curve.connect(accounts[0]).addLiquidity([10, hundredEurs], 0, {
        value: 100,
      });
      // gasUsed: 325k

      const poolBalance = await poolToken.balanceOf(accounts[0].address);

      expect(poolBalance).to.be.gte(1n * 10n ** 18n);

      await poolToken.connect(accounts[0]).approve(curve.address, poolBalance);

      const uBalance0 = await usdc.balanceOf(accounts[0].address);
      const eBalance0 = await eurs.balanceOf(accounts[0].address);

      await curve.connect(accounts[0]).removeLiquidity(poolBalance, [0, 0], {
        value: 10000,
        gasLimit: 2_000_000,
      });
      // gasUsed: 201k

      const uBalance1 = await usdc.balanceOf(accounts[0].address);
      const eBalance1 = await eurs.balanceOf(accounts[0].address);

      expect(uBalance1).to.be.gt(uBalance0);
      expect(eBalance1).to.be.gt(eBalance0);
    });

    it("Should add_liquidity for 2 tokens and remove_one_coin", async () => {
      const curve = await loadFixture(deploy);

      const hundredUsdc = 100n * 10n ** 6n;
      const hundredEurs = 100n * 10n ** 2n;

      await usdc.connect(accounts[0]).approve(curve.address, hundredUsdc);
      await eurs.connect(accounts[0]).approve(curve.address, hundredEurs);

      await curve
        .connect(accounts[0])
        .addLiquidity([hundredUsdc, hundredEurs], 0, {
          value: 100,
        });

      const poolBalance = await poolToken.balanceOf(accounts[0].address);

      expect(poolBalance).to.be.gte(1n * 10n ** 18n);

      await poolToken.connect(accounts[0]).approve(curve.address, poolBalance);

      const eBalance0 = await eurs.balanceOf(accounts[0].address);

      await curve
        .connect(accounts[0])
        .removeLiquidityOneCoin(poolBalance, 0, 0, {
          value: 10000000,
          gasLimit: 5_000_000,
        });
      // gasUsed: 232k

      const eBalance1 = await eurs.balanceOf(accounts[0].address);

      expect(eBalance1).to.be.gte(eBalance0);
    });
  });

  describe("Admin actions", () => {
    it("Withdraws money", async () => {
      const curve = await loadFixture(deploy);

      await curve.connect(accounts[0]).withdrawAdmin();

      const balanceAfterWithdrawal = await ethers.provider.getBalance(
        curve.address
      );

      expect(balanceAfterWithdrawal).to.equal(0);
    });
  });
});
