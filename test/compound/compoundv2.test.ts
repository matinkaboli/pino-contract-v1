// Compound V2
import { expect } from "chai";
import { ethers } from "hardhat";
import { constants } from "ethers";
import { PERMIT2_ADDRESS } from "@uniswap/permit2-sdk";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ICToken, IERC20, IWETH9 } from "../../typechain-types";
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
import { impersonate, signer } from "../utils/helpers";

const WHALE = "0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8";
const WBTC_WHALE = "0x845cbcb8230197f733b59cfe1795f282786f212c";
const AAVE_WHALE = "0x26a78d5b6d7a7aceedd1e6ee3229b372a624d8b7";

describe("Compound V2", () => {
  let dai: IERC20;
  let aave: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let wbtc: IERC20;
  let weth: IWETH9;
  let cDai: ICToken;
  let cEth: ICToken;
  let cAave: ICToken;
  let cUsdc: ICToken;
  let cUsdt: ICToken;
  let account: SignerWithAddress;

  const deploy = async () => {
    const Compound = await ethers.getContractFactory("Compound");
    const contract = await Compound.deploy(
      PERMIT2_ADDRESS,
      [USDC, DAI],
      [C_USDC_V2, C_DAI]
    );

    await contract.approveToken(USDT, C_USDT);
    await contract.approveToken(AAVE, C_AAVE);

    return { contract, sign: await signer(account) };
  };

  before(async () => {
    [account] = await ethers.getSigners();
    const whale = await impersonate(WHALE);
    const wbtcWhale = await impersonate(WBTC_WHALE);
    const aaveWhale = await impersonate(AAVE_WHALE);

    dai = await ethers.getContractAt("IERC20", DAI);
    usdc = await ethers.getContractAt("IERC20", USDC);
    usdt = await ethers.getContractAt("IERC20", USDT);
    wbtc = await ethers.getContractAt("IERC20", WBTC);
    aave = await ethers.getContractAt("IERC20", AAVE);
    weth = await ethers.getContractAt("IWETH9", WETH);
    cEth = await ethers.getContractAt("ICToken", C_ETH);
    cDai = await ethers.getContractAt("ICToken", C_DAI);
    cUsdt = await ethers.getContractAt("ICToken", C_USDT);
    cAave = await ethers.getContractAt("ICToken", C_AAVE);
    cUsdc = await ethers.getContractAt("ICToken", C_USDC_V2);

    const ethAmount = 3n * 10n ** 18n;
    const usdAmount = 5000n * 10n ** 6n;
    const daiAmount = 5000n * 10n ** 18n;
    const wbtcAmount = 5000n * 10n ** 8n;

    await dai.connect(whale).transfer(account.address, daiAmount);
    await usdc.connect(whale).transfer(account.address, usdAmount);
    await usdt.connect(whale).transfer(account.address, usdAmount);
    await aave.connect(aaveWhale).transfer(account.address, daiAmount);
    await wbtc.connect(wbtcWhale).transfer(account.address, wbtcAmount);
    await weth.deposit({
      value: ethAmount,
    });

    expect(await dai.balanceOf(account.address)).to.gte(daiAmount);
    expect(await usdc.balanceOf(account.address)).to.gte(usdAmount);
    expect(await usdt.balanceOf(account.address)).to.gte(usdAmount);
    expect(await weth.balanceOf(account.address)).to.gte(ethAmount);
    expect(await aave.balanceOf(account.address)).to.gte(daiAmount);
    expect(await wbtc.balanceOf(account.address)).to.gte(wbtcAmount);

    await dai.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await usdc.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await usdt.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await weth.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await aave.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await wbtc.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await cDai.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await cEth.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await cUsdc.approve(PERMIT2_ADDRESS, constants.MaxUint256);
  });

  describe("Deployment", () => {
    it("Should deploy with 0 tokens", async () => {
      const Compound = await ethers.getContractFactory("Compound");
      await Compound.deploy(PERMIT2_ADDRESS, [], []);
    });

    it("Should deploy given some tokens", async () => {
      const Compound = await ethers.getContractFactory("Compound");
      await Compound.deploy(PERMIT2_ADDRESS, [WBTC, USDC], [C_WBTC, C_USDC_V2]);
    });

    it("Should deploy given all tokens", async () => {
      const Compound = await ethers.getContractFactory("Compound");
      await Compound.deploy(
        PERMIT2_ADDRESS,
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
        ]
      );
    });
  });

  describe("Supply", () => {
    it("Should supply USDC", async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 150n * 10n * 6n;

      const { permit, signature } = await sign(
        {
          token: USDC,
          amount,
        },
        contract.address
      );

      const cUsdcBalanceBefore = await cUsdc.balanceOf(account.address);

      await contract.supply(permit, signature, C_USDC_V2);
      // gasUsed: 314k

      expect(await cUsdc.balanceOf(account.address)).to.gt(cUsdcBalanceBefore);
    });

    it("Should supply USDT", async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 150n * 10n ** 6n;

      const { permit, signature } = await sign(
        {
          token: USDT,
          amount,
        },
        contract.address
      );

      const cUsdtBalanceBefore = await cUsdt.balanceOf(account.address);

      await contract.supply(permit, signature, C_USDT);
      // gasUsed: 311k

      expect(await cUsdt.balanceOf(account.address)).to.gt(cUsdtBalanceBefore);
    });

    it("Should supply DAI", async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 100n * 10n ** 18n;

      const { permit, signature } = await sign(
        {
          token: DAI,
          amount,
        },
        contract.address
      );

      const cDaiBalanceBefore = await cDai.balanceOf(account.address);

      await contract.supply(permit, signature, C_DAI);
      // gasUsed: 302k

      expect(await cDai.balanceOf(account.address)).gt(cDaiBalanceBefore);
    });

    it("Should supply AAVE", async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 100n * 10n ** 18n;

      const { permit, signature } = await sign(
        {
          token: AAVE,
          amount,
        },
        contract.address
      );

      const cAaveBalanceBefore = await cAave.balanceOf(account.address);

      await contract.supply(permit, signature, C_AAVE);
      // gasUsed: 570k

      expect(await cAave.balanceOf(account.address)).gt(cAaveBalanceBefore);
    });

    it("Should supply ETH", async () => {
      const { contract } = await loadFixture(deploy);

      const fee = 3000n;
      const amount = 1n * 10n ** 18n;

      const cEthBalanceBefore = await cEth.balanceOf(account.address);

      await contract.supplyETH(C_ETH, fee, {
        value: amount + fee,
      });
      // gasUsed: 223k

      const cEthBalanceAfter = await cEth.balanceOf(account.address);

      expect(cEthBalanceAfter).gt(cEthBalanceBefore);
    });
  });

  describe("Withdraw", () => {
    it("Should supply USDC and withdraw USDC", async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 150n * 10n ** 6n;
      const minimumAmount = 140n * 10n ** 6n;

      const { permit: permit1, signature: signature1 } = await sign(
        {
          token: USDC,
          amount,
        },
        contract.address
      );

      const cUsdcBalanceBefore = await cUsdc.balanceOf(account.address);

      await contract.supply(permit1, signature1, C_USDC_V2);

      const cUsdcBalanceAfter = await cUsdc.balanceOf(account.address);

      expect(cUsdcBalanceAfter).to.gt(cUsdcBalanceBefore);

      const { permit: permit2, signature: signature2 } = await sign(
        {
          token: C_USDC_V2,
          amount: cUsdcBalanceAfter,
        },
        contract.address
      );

      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      await contract.withdraw(permit2, signature2, USDC);
      // gasUsed: 270k

      expect(await usdc.balanceOf(account.address)).to.gt(
        usdcBalanceBefore.add(minimumAmount)
      );
    });

    it("Should supply ETH and withdraw", async () => {
      const { contract, sign } = await loadFixture(deploy);

      const fee = 3000n;
      const amount = 10n * 10n ** 17n;
      const minimumAmount = 8n * 10n ** 17n;

      const cEthBalanceBefore = await cEth.balanceOf(account.address);

      await contract.supplyETH(C_ETH, fee, {
        value: amount + fee,
      });
      // gasUsed: 223k

      const cEthBalanceAfter = await cEth.balanceOf(account.address);

      expect(cEthBalanceAfter).gt(cEthBalanceBefore);

      const { permit, signature } = await sign(
        {
          token: C_ETH,
          amount: cEthBalanceAfter,
        },
        contract.address
      );

      const balanceBefore = await account.getBalance();

      await contract.withdrawETH(permit, signature);
      // gasUsed: 201k

      expect(await account.getBalance()).to.gt(
        balanceBefore.add(minimumAmount)
      );
    });

    it("Should supply DAI and withdraw it", async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 100n * 10n ** 18n;
      const minimumAmount = 95n * 10n ** 18n;

      const { permit: permit1, signature: signature1 } = await sign(
        {
          token: DAI,
          amount,
        },
        contract.address
      );

      const cDaiBalanceBefore = await cDai.balanceOf(account.address);

      await contract.supply(permit1, signature1, C_DAI);

      const cDaiBalanceAfter = await cDai.balanceOf(account.address);

      expect(cDaiBalanceAfter).gt(cDaiBalanceBefore);

      const { permit: permit2, signature: signature2 } = await sign(
        {
          token: C_DAI,
          amount: cDaiBalanceAfter,
        },
        contract.address
      );

      const daiBalanceBefore = await dai.balanceOf(account.address);

      await contract.withdraw(permit2, signature2, DAI);
      // gasUsed: 256k

      expect(await dai.balanceOf(account.address)).to.gt(
        daiBalanceBefore.add(minimumAmount)
      );
    });
  });

  describe("Admin", () => {
    it("Should withdraw money", async () => {
      const { contract } = await loadFixture(deploy);

      const amount = 10n * 10n ** 18n;

      await account.sendTransaction({
        to: contract.address,
        value: amount,
      });

      const balanceBefore = await account.getBalance();

      await contract.withdrawAdmin();

      expect(await account.getBalance()).to.gt(balanceBefore);
    });
  });
});
