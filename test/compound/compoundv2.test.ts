// Compound V2
import hardhat from "hardhat";
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ICToken, IERC20 } from "../../typechain-types";
import wethInterface from "../utils/wethInterface.json";
import {
  DAI,
  USDC,
  USDT,
  WETH,
  WBTC,
  BAT,
  UNI,
  LINK,
  COMP,
  USDP,
  AAVE,
  C_DAI,
  C_WBTC,
  C_USDT,
  C_ETH,
  C_USDC_V2,
  C_BAT,
  C_UNI,
  C_LINK,
  C_COMP,
  C_USDP,
  C_AAVE,
} from "../utils/addresses";
import { Contract } from "ethers";

const WHALE = "0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8";
const WBTC_WHALE = "0x845cbcb8230197f733b59cfe1795f282786f212c";
const AAVE_WHALE = "0x26a78d5b6d7a7aceedd1e6ee3229b372a624d8b7";

describe("Compound V2", () => {
  let dai: IERC20;
  let aave: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let wbtc: IERC20;
  let weth: Contract;

  let cDai: ICToken;
  let cEth: ICToken;
  let cAave: ICToken;
  let cUsdc: ICToken;
  let cUsdt: ICToken;

  let accounts: SignerWithAddress[];

  const deploy = async () => {
    const Compound = await ethers.getContractFactory("Compound");
    const compound = await Compound.connect(accounts[0]).deploy(
      [USDC, DAI],
      [C_USDC_V2, C_DAI],
      {
        gasLimit: 2_000_000,
      }
    );

    return compound;
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

    await hardhat.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [AAVE_WHALE],
    });

    accounts = await ethers.getSigners();
    const whale = await ethers.getSigner(WHALE);
    const wbtcWhale = await ethers.getSigner(WBTC_WHALE);
    const aaveWhale = await ethers.getSigner(AAVE_WHALE);

    dai = await ethers.getContractAt("IERC20", DAI);
    usdc = await ethers.getContractAt("IERC20", USDC);
    usdt = await ethers.getContractAt("IERC20", USDT);
    wbtc = await ethers.getContractAt("IERC20", WBTC);
    aave = await ethers.getContractAt("IERC20", AAVE);
    weth = new ethers.Contract(WETH, wethInterface, whale);

    cEth = await ethers.getContractAt("ICToken", C_ETH);
    cDai = await ethers.getContractAt("ICToken", C_DAI);
    cUsdt = await ethers.getContractAt("ICToken", C_USDT);
    cAave = await ethers.getContractAt("ICToken", C_AAVE);
    cUsdc = await ethers.getContractAt("ICToken", C_USDC_V2);

    const ethAmount = 3n * 10n ** 18n;
    const usdAmount = 5000n * 10n ** 6n;
    const daiAmount = 5000n * 10n ** 18n;
    const wbtcAmount = 5000n * 10n ** 8n;

    await dai.connect(whale).transfer(accounts[0].address, daiAmount);
    await usdc.connect(whale).transfer(accounts[0].address, usdAmount);
    await usdt.connect(whale).transfer(accounts[0].address, usdAmount);
    await aave.connect(aaveWhale).transfer(accounts[0].address, daiAmount);
    await wbtc.connect(wbtcWhale).transfer(accounts[0].address, wbtcAmount);
    await weth.connect(accounts[0]).deposit({
      value: ethAmount,
    });

    const daiBalance = await dai.balanceOf(accounts[0].address);
    const usdcBalance = await usdc.balanceOf(accounts[0].address);
    const usdtBalance = await usdt.balanceOf(accounts[0].address);
    const wethBalance = await weth.balanceOf(accounts[0].address);
    const wbtcBalance = await wbtc.balanceOf(accounts[0].address);
    const aaveBalance = await aave.balanceOf(accounts[0].address);

    expect(daiBalance).to.gte(daiAmount);
    expect(usdcBalance).to.gte(usdAmount);
    expect(usdtBalance).to.gte(usdAmount);
    expect(wethBalance).to.gte(ethAmount);
    expect(aaveBalance).to.gte(daiAmount);
    expect(wbtcBalance).to.gte(wbtcAmount);
  });

  describe("Deployment", () => {
    it("Should deploy with 0 tokens", async () => {
      const Compound = await ethers.getContractFactory("Compound");
      await Compound.connect(accounts[0]).deploy([], []);
    });

    it("Should deploy given some tokens", async () => {
      const Compound = await ethers.getContractFactory("Compound");
      await Compound.connect(accounts[0]).deploy(
        [WBTC, USDC],
        [C_WBTC, C_USDC_V2],
        {
          gasLimit: 2_000_000,
        }
      );
    });

    it("Should deploy given all tokens", async () => {
      const Compound = await ethers.getContractFactory("Compound");
      await Compound.connect(accounts[0]).deploy(
        [DAI, USDC, USDT, WBTC, BAT, UNI, LINK, COMP, USDP, AAVE],
        [
          C_DAI,
          C_USDC_V2,
          C_USDT,
          C_WBTC,
          C_BAT,
          C_UNI,
          C_LINK,
          C_COMP,
          C_USDP,
          C_AAVE,
        ],
        {
          gasLimit: 8_000_000,
        }
      );
    });
  });

  describe("Supply", () => {
    it("Should supply USDC", async () => {
      const compound = await loadFixture(deploy);

      const amount = 150n * 10n * 6n;

      await usdc.approve(compound.address, amount);

      const cUsdcBalanceBefore = await cUsdc.balanceOf(accounts[0].address);

      await compound.supply(USDC, C_USDC_V2, amount);
      // gasUsed: 275k

      const cUsdcBalanceAfter = await cUsdc.balanceOf(accounts[0].address);

      expect(cUsdcBalanceAfter).to.gt(cUsdcBalanceBefore);
    });

    it("Should supply USDT", async () => {
      const compound = await loadFixture(deploy);

      const amount = 150n * 10n ** 6n;

      await usdt.connect(accounts[0]).approve(compound.address, amount);

      const cUsdtBalanceBefore = await cUsdt.balanceOf(accounts[0].address);

      await compound.supply(USDT, C_USDT, amount);
      // gasUsed: 270k

      const cUsdtBalanceAfter = await cUsdt.balanceOf(accounts[0].address);

      expect(cUsdtBalanceAfter).to.gt(cUsdtBalanceBefore);
    });

    it("Should supply DAI", async () => {
      const compound = await loadFixture(deploy);

      const amount = 100n * 10n ** 18n;

      await dai.connect(accounts[0]).approve(compound.address, amount);

      const cDaiBalanceBefore = await cDai.balanceOf(accounts[0].address);

      await compound.connect(accounts[0]).supply(DAI, C_DAI, amount);
      // gasUsed: 270k

      const cDaiBalanceAfter = await cDai.balanceOf(accounts[0].address);

      expect(cDaiBalanceAfter).gt(cDaiBalanceBefore);
    });

    it("Should supply AAVE", async () => {
      const compound = await loadFixture(deploy);

      const amount = 100n * 10n ** 18n;

      await aave.connect(accounts[0]).approve(compound.address, amount);

      const cAaveBalanceBefore = await cAave.balanceOf(accounts[0].address);

      await compound.connect(accounts[0]).supply(AAVE, C_AAVE, amount);
      // gasUsed: 576k

      const cAaveBalanceAfter = await cAave.balanceOf(accounts[0].address);

      expect(cAaveBalanceAfter).gt(cAaveBalanceBefore);
    });

    it("Should supply ETH", async () => {
      const compound = await loadFixture(deploy);

      const fee = 3000n;
      const amount = 1n * 10n ** 18n;

      const cEthBalanceBefore = await cEth.balanceOf(accounts[0].address);

      await compound.connect(accounts[0]).supplyETH(C_ETH, fee, {
        value: amount + fee,
      });
      // gasUsed: 223k

      const cEthBalanceAfter = await cEth.balanceOf(accounts[0].address);

      expect(cEthBalanceAfter).gt(cEthBalanceBefore);
    });
  });

  describe("Withdraw", () => {
    it("Should supply USDC and withdraw USDC", async () => {
      const compound = await loadFixture(deploy);

      const amount = 150n * 10n ** 6n;
      const minimumAmount = 140n * 10n ** 6n;

      await usdc.approve(compound.address, amount);

      const cUsdcBalanceBefore = await cUsdc.balanceOf(accounts[0].address);

      await compound.supply(USDC, C_USDC_V2, amount);
      // gasUsed: 276k

      const cUsdcBalanceAfter = await cUsdc.balanceOf(accounts[0].address);

      expect(cUsdcBalanceAfter).to.gt(cUsdcBalanceBefore);

      await cUsdc
        .connect(accounts[0])
        .approve(compound.address, cUsdcBalanceAfter);

      const usdcBalanceBefore = await usdc.balanceOf(accounts[0].address);

      await compound.withdraw(USDC, C_USDC_V2, cUsdcBalanceAfter);
      // gasUsed: 229k

      const usdcBalanceAfter = await usdc.balanceOf(accounts[0].address);

      expect(usdcBalanceAfter).to.gt(usdcBalanceBefore.add(minimumAmount));
    });

    it("Should supply ETH and withdraw", async () => {
      const compound = await loadFixture(deploy);

      const fee = 3000n;
      const amount = 10n * 10n ** 17n;
      const minimumAmount = 8n * 10n ** 17n;

      const cEthBalanceBefore = await cEth.balanceOf(accounts[0].address);

      await compound.connect(accounts[0]).supplyETH(C_ETH, fee, {
        value: amount + fee,
      });
      // gasUsed: 223k

      const cEthBalanceAfter = await cEth.balanceOf(accounts[0].address);

      expect(cEthBalanceAfter).gt(cEthBalanceBefore);

      await cEth
        .connect(accounts[0])
        .approve(compound.address, cEthBalanceAfter);

      const balanceBefore = await accounts[0].getBalance();

      await compound.connect(accounts[0]).withdrawETH(C_ETH, cEthBalanceAfter);
      // gasUsed: 192k

      const balanceAfter = await accounts[0].getBalance();

      expect(balanceAfter).to.gt(balanceBefore.add(minimumAmount));
    });

    it("Should supply DAI and withdraw it", async () => {
      const compound = await loadFixture(deploy);

      const amount = 100n * 10n ** 18n;
      const minimumAmount = 95n * 10n ** 18n;

      await dai.connect(accounts[0]).approve(compound.address, amount);

      const cDaiBalanceBefore = await cDai.balanceOf(accounts[0].address);

      await compound.connect(accounts[0]).supply(DAI, C_DAI, amount);
      // gasUsed: 270k

      const cDaiBalanceAfter = await cDai.balanceOf(accounts[0].address);

      expect(cDaiBalanceAfter).gt(cDaiBalanceBefore);

      await cDai
        .connect(accounts[0])
        .approve(compound.address, cDaiBalanceAfter);

      const daiBalanceBefore = await dai.balanceOf(accounts[0].address);

      await compound
        .connect(accounts[0])
        .withdraw(DAI, C_DAI, cDaiBalanceAfter);
      // gasUsed: 219k

      const daiBalanceAfter = await dai.balanceOf(accounts[0].address);

      expect(daiBalanceAfter).to.gt(daiBalanceBefore.add(minimumAmount));
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

      const balanceBefore = await accounts[0].getBalance();

      await comet.withdrawAdmin();

      const balanceAfter = await accounts[0].getBalance();

      expect(balanceAfter).to.gt(balanceBefore);
    });
  });
});
