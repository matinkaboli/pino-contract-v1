// Comet
import hardhat from "hardhat";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

import { IERC20 } from "../../typechain-types";
import wethInterface from "../utils/wethInterface.json";
import cometInterface from "../utils/cometInterface.json";
import { USDC, C_USDC, LINK, COMP, WETH, UNI, WBTC } from "../utils/addresses";

const WHALE = "0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8";
const WBTC_WHALE = "0x845cbcb8230197f733b59cfe1795f282786f212c";

describe("Comet (Compound V3)", () => {
  let usdc: IERC20;
  let wbtc: IERC20;
  let cUsdc: IERC20;
  let weth: Contract;
  let cometContract: Contract;
  let accounts: SignerWithAddress[];

  const deploy = async () => {
    const Comet = await ethers.getContractFactory("Comet");
    const comet = await Comet.connect(accounts[0]).deploy(
      C_USDC,
      WETH,
      [USDC, WETH],
      {
        gasLimit: 10_000_000,
      }
    );

    return comet;
  };

  before(async () => {
    await hardhat.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WHALE],
    });
    await hardhat.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WBTC_WHALE],
    });

    accounts = await ethers.getSigners();
    const whale = await ethers.getSigner(WHALE);
    const wbtcWhale = await ethers.getSigner(WBTC_WHALE);

    usdc = await ethers.getContractAt("IERC20", USDC);
    wbtc = await ethers.getContractAt("IERC20", WBTC);
    cUsdc = await ethers.getContractAt("IERC20", C_USDC);
    weth = new ethers.Contract(WETH, wethInterface, whale);
    cometContract = new ethers.Contract(C_USDC, cometInterface, whale);

    const amount = 5000n * 10n ** 6n;
    const ethAmount = 3n * 10n ** 18n;
    const wbtcAmount = 1000n * 10n ** 8n;

    await usdc.connect(whale).transfer(accounts[0].address, amount);
    await wbtc.connect(wbtcWhale).transfer(accounts[0].address, wbtcAmount);
    await weth.connect(accounts[0]).deposit({
      value: ethAmount,
    });

    const usdcBalance = await usdc.balanceOf(accounts[0].address);
    const wbtcBalance = await wbtc.balanceOf(accounts[0].address);
    const wethBalance = await weth.balanceOf(accounts[0].address);

    expect(usdcBalance).to.gte(amount);
    expect(wethBalance).to.gte(ethAmount);
    expect(wbtcBalance).to.gte(wbtcAmount);
  });

  describe("Deployment", () => {
    it("Should deploy with 0 tokens", async () => {
      const Comet = await ethers.getContractFactory("Comet");

      await Comet.connect(accounts[0]).deploy(C_USDC, WETH, []);
    });

    it("Should deploy with multiple tokens", async () => {
      const Comet = await ethers.getContractFactory("Comet");

      await Comet.connect(accounts[0]).deploy(C_USDC, WETH, [USDC, WETH]);
    });

    it("Should deploy with all comet tokens", async () => {
      const Comet = await ethers.getContractFactory("Comet");

      await Comet.connect(accounts[0]).deploy(C_USDC, WETH, [
        USDC,
        LINK,
        COMP,
        WETH,
        UNI,
        WBTC,
      ]);
    });
  });

  describe("Supply", () => {
    it("Should supply USDC", async () => {
      const comet = await loadFixture(deploy);

      const amount = 200n * 10n ** 6n;
      const minimumAmount = 190n * 10n ** 6n;

      const cUsdcBalanceBefore = await cUsdc.balanceOf(accounts[0].address);

      await usdc.connect(accounts[0]).approve(comet.address, amount);

      await comet.supply(USDC, amount);
      // gasUsed: 131k

      const cUsdcBalanceAfter = await cUsdc.balanceOf(accounts[0].address);

      expect(cUsdcBalanceAfter).to.gt(cUsdcBalanceBefore.add(minimumAmount));
    });

    it("Should supply WETH", async () => {
      const comet = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      await weth.connect(accounts[0]).approve(comet.address, amount);

      await comet.supply(WETH, amount);
      // gasUsed: 130k

      const collateralBalance = await cometContract.collateralBalanceOf(
        accounts[0].address,
        WETH
      );

      expect(collateralBalance).to.gte(amount);
    });

    it("Should supply ETH", async () => {
      const comet = await loadFixture(deploy);

      const fee = 3000n;
      const amount = 1n * 10n ** 18n;

      await comet.supplyETH(fee, {
        value: amount + fee,
      });
      // gasUsed: 124k

      const collateralBalance = await cometContract.collateralBalanceOf(
        accounts[0].address,
        WETH
      );

      expect(collateralBalance).to.gte(amount);
    });

    it("Should supply WBTC", async () => {
      const comet = await loadFixture(deploy);

      const amount = 500n * 10n ** 8n;

      await wbtc.connect(accounts[0]).approve(comet.address, amount);

      await comet.supply(WBTC, amount);
      // gasUsed: 160k

      const collateralBalance = await cometContract.collateralBalanceOf(
        accounts[0].address,
        WBTC
      );

      expect(collateralBalance).to.gte(amount);
    });
  });

  describe("Withdraw", () => {
    it("Should supply USDC and withdraw it", async () => {
      const comet = await loadFixture(deploy);

      const amount = 200n * 10n ** 6n;
      const minimumAmount = 190n * 10n ** 6n;

      const cUsdcBalanceBefore = await cUsdc.balanceOf(accounts[0].address);

      await usdc.connect(accounts[0]).approve(comet.address, amount);

      await comet.supply(USDC, amount);
      // gasUsed: 131k

      const cUsdcBalanceAfter = await cUsdc.balanceOf(accounts[0].address);

      expect(cUsdcBalanceAfter).to.gt(cUsdcBalanceBefore.add(minimumAmount));

      await cometContract.connect(accounts[0]).allow(comet.address, true);
      // gasUsed: 57k

      const usdcBalanceBefore = await usdc.balanceOf(accounts[0].address);

      await comet.withdraw(USDC, cUsdcBalanceAfter);
      // gasUsed: 92k

      const usdcBalanceAfter = await usdc.balanceOf(accounts[0].address);

      expect(usdcBalanceAfter).to.gt(usdcBalanceBefore);
    });

    it("Should supply WBTC and withdraw it", async () => {
      const comet = await loadFixture(deploy);

      const amount = 5n * 10n ** 8n;

      await wbtc.connect(accounts[0]).approve(comet.address, amount);

      await comet.supply(WBTC, amount);
      // gasUsed: 160k

      const collateralBalance = await cometContract.collateralBalanceOf(
        accounts[0].address,
        WBTC
      );

      expect(collateralBalance).to.gte(amount);

      await cometContract.connect(accounts[0]).allow(comet.address, true);
      // gasUsed: 57k

      const wbtcBalanceBefore = await wbtc.balanceOf(accounts[0].address);

      await comet.withdraw(WBTC, collateralBalance);
      // gasUsed: 92k

      const wbtcBalanceAfter = await wbtc.balanceOf(accounts[0].address);

      expect(wbtcBalanceAfter).to.gt(wbtcBalanceBefore);
    });

    it("Should supply WETH and withdraw it", async () => {
      const comet = await loadFixture(deploy);

      const amount = 500n * 10n ** 8n;

      await weth.connect(accounts[0]).approve(comet.address, amount);

      await comet.supply(WETH, amount);
      // gasUsed: 160k

      const collateralBalance = await cometContract.collateralBalanceOf(
        accounts[0].address,
        WETH
      );

      expect(collateralBalance).to.gte(amount);

      await cometContract.connect(accounts[0]).allow(comet.address, true);
      // gasUsed: 57k

      const wethBalanceBefore = await weth.balanceOf(accounts[0].address);

      await comet.connect(accounts[0]).withdraw(WETH, collateralBalance);
      // gasUsed: 92k

      const wethBalanceAfter = await weth.balanceOf(accounts[0].address);

      expect(wethBalanceAfter).to.gt(wethBalanceBefore);
    });

    it("Should supply WETH and withdraw ETH", async () => {
      const comet = await loadFixture(deploy);

      const amount = 20n * 10n ** 16n;
      const minimumAmount = 17n * 10n ** 16n;

      await weth.connect(accounts[0]).approve(comet.address, amount);

      await comet.supply(WETH, amount);
      // gasUsed: 160k

      const collateralBalance = await cometContract.collateralBalanceOf(
        accounts[0].address,
        WETH
      );

      expect(collateralBalance).to.gte(amount);

      await cometContract.connect(accounts[0]).allow(comet.address, true);
      // gasUsed: 57k

      const balanceBefore = await ethers.provider.getBalance(
        accounts[0].address
      );

      await comet.connect(accounts[0]).withdrawETH(collateralBalance);
      // gasUsed: 93k

      const balanceAfter = await ethers.provider.getBalance(
        accounts[0].address
      );

      expect(balanceAfter).to.gt(balanceBefore.add(minimumAmount));
    });

    it("Should supply ETH and withdraw ETH", async () => {
      const comet = await loadFixture(deploy);

      const fee = 3000n;
      const amount = 20n * 10n ** 16n;
      const minimumAmount = 18n * 10n ** 16n;

      await comet.supplyETH(fee, {
        value: amount + fee,
      });
      // gasUsed: 124k

      const collateralBalance = await cometContract.collateralBalanceOf(
        accounts[0].address,
        WETH
      );

      expect(collateralBalance).to.gte(amount);

      await cometContract.connect(accounts[0]).allow(comet.address, true);
      // gasUsed: 57k

      const balanceBefore = await ethers.provider.getBalance(
        accounts[0].address
      );

      await comet.connect(accounts[0]).withdrawETH(collateralBalance);
      // gasUsed: 93k

      const balanceAfter = await ethers.provider.getBalance(
        accounts[0].address
      );

      expect(balanceAfter).to.gt(balanceBefore.add(minimumAmount));
    });
  });

  describe("Admin", () => {
    it("Should withdraw money", async () => {
      const comet = await loadFixture(deploy);

      const amount = 10n * 10n ** 18n;

      await accounts[0].sendTransaction({
        to: comet.address,
        value: amount,
      });

      const balanceBefore = await ethers.provider.getBalance(
        accounts[0].address
      );

      await comet.withdrawAdmin();

      const balanceAfter = await ethers.provider.getBalance(
        accounts[0].address
      );

      expect(balanceAfter).to.gt(balanceBefore);
    });
  });
});
