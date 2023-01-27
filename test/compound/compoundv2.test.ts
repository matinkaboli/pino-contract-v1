// Compound V2
import hardhat from "hardhat";
import { expect } from "chai";
import { ethers } from "hardhat";
import { constants, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import {
  PERMIT2_ADDRESS,
  TokenPermissions,
  SignatureTransfer,
} from "@uniswap/permit2-sdk";
import { PermitTransferFrom } from "@uniswap/permit2-sdk/dist/PermitTransferFrom";
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

const WHALE = "0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8";
const WBTC_WHALE = "0x845cbcb8230197f733b59cfe1795f282786f212c";
const AAVE_WHALE = "0x26a78d5b6d7a7aceedd1e6ee3229b372a624d8b7";

describe("Compound V2", () => {
  let chainId: number;
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

  let account: SignerWithAddress;

  const deploy = async () => {
    const Compound = await ethers.getContractFactory("Compound");
    const compound = await Compound.connect(account).deploy(
      PERMIT2_ADDRESS,
      [USDC, DAI],
      [C_USDC_V2, C_DAI]
    );

    await compound.connect(account).approveToken(USDT, C_USDT);
    await compound.connect(account).approveToken(AAVE, C_AAVE);

    return compound;
  };

  const sign = async (permitted: TokenPermissions, spender: string) => {
    const permit: PermitTransferFrom = {
      permitted,
      spender,
      nonce: Math.floor(Math.random() * 5000),
      deadline: constants.MaxUint256,
    };

    const { domain, types, values } = SignatureTransfer.getPermitData(
      permit,
      PERMIT2_ADDRESS,
      chainId
    );

    const signature = await account._signTypedData(domain, types, values);

    return { permit, signature };
  };

  before(async () => {
    const network = await ethers.provider.getNetwork();
    chainId = network.chainId;

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

    [account] = await ethers.getSigners();
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

    await dai.connect(whale).transfer(account.address, daiAmount);
    await usdc.connect(whale).transfer(account.address, usdAmount);
    await usdt.connect(whale).transfer(account.address, usdAmount);
    await aave.connect(aaveWhale).transfer(account.address, daiAmount);
    await wbtc.connect(wbtcWhale).transfer(account.address, wbtcAmount);
    await weth.connect(account).deposit({
      value: ethAmount,
    });

    const daiBalance = await dai.balanceOf(account.address);
    const usdcBalance = await usdc.balanceOf(account.address);
    const usdtBalance = await usdt.balanceOf(account.address);
    const wethBalance = await weth.balanceOf(account.address);
    const wbtcBalance = await wbtc.balanceOf(account.address);
    const aaveBalance = await aave.balanceOf(account.address);

    expect(daiBalance).to.gte(daiAmount);
    expect(usdcBalance).to.gte(usdAmount);
    expect(usdtBalance).to.gte(usdAmount);
    expect(wethBalance).to.gte(ethAmount);
    expect(aaveBalance).to.gte(daiAmount);
    expect(wbtcBalance).to.gte(wbtcAmount);

    await dai.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await usdc.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await usdt.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await weth.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await aave.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await wbtc.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await cDai.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await cEth.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await cUsdc.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
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
      const compound = await loadFixture(deploy);

      const amount = 150n * 10n * 6n;

      const { permit, signature } = await sign(
        {
          token: USDC,
          amount,
        },
        compound.address
      );

      const cUsdcBalanceBefore = await cUsdc.balanceOf(account.address);

      await compound.supply(permit, signature, C_USDC_V2);
      // gasUsed: 314k

      expect(await cUsdc.balanceOf(account.address)).to.gt(cUsdcBalanceBefore);
    });

    it("Should supply USDT", async () => {
      const compound = await loadFixture(deploy);

      const amount = 150n * 10n ** 6n;

      const { permit, signature } = await sign(
        {
          token: USDT,
          amount,
        },
        compound.address
      );

      const cUsdtBalanceBefore = await cUsdt.balanceOf(account.address);

      await compound.supply(permit, signature, C_USDT);
      // gasUsed: 311k

      expect(await cUsdt.balanceOf(account.address)).to.gt(cUsdtBalanceBefore);
    });

    it("Should supply DAI", async () => {
      const compound = await loadFixture(deploy);

      const amount = 100n * 10n ** 18n;

      const { permit, signature } = await sign(
        {
          token: DAI,
          amount,
        },
        compound.address
      );

      const cDaiBalanceBefore = await cDai.balanceOf(account.address);

      await compound.supply(permit, signature, C_DAI);
      // gasUsed: 302k

      expect(await cDai.balanceOf(account.address)).gt(cDaiBalanceBefore);
    });

    it("Should supply AAVE", async () => {
      const compound = await loadFixture(deploy);

      const amount = 100n * 10n ** 18n;

      const { permit, signature } = await sign(
        {
          token: AAVE,
          amount,
        },
        compound.address
      );

      const cAaveBalanceBefore = await cAave.balanceOf(account.address);

      await compound.supply(permit, signature, C_AAVE);
      // gasUsed: 570k

      expect(await cAave.balanceOf(account.address)).gt(cAaveBalanceBefore);
    });

    it("Should supply ETH", async () => {
      const compound = await loadFixture(deploy);

      const fee = 3000n;
      const amount = 1n * 10n ** 18n;

      const cEthBalanceBefore = await cEth.balanceOf(account.address);

      await compound.supplyETH(C_ETH, fee, {
        value: amount + fee,
      });
      // gasUsed: 223k

      const cEthBalanceAfter = await cEth.balanceOf(account.address);

      expect(cEthBalanceAfter).gt(cEthBalanceBefore);
    });
  });

  describe("Withdraw", () => {
    it("Should supply USDC and withdraw USDC", async () => {
      const compound = await loadFixture(deploy);

      const amount = 150n * 10n ** 6n;
      const minimumAmount = 140n * 10n ** 6n;

      const { permit: permit1, signature: signature1 } = await sign(
        {
          token: USDC,
          amount,
        },
        compound.address
      );

      const cUsdcBalanceBefore = await cUsdc.balanceOf(account.address);

      await compound.supply(permit1, signature1, C_USDC_V2);

      const cUsdcBalanceAfter = await cUsdc.balanceOf(account.address);

      expect(cUsdcBalanceAfter).to.gt(cUsdcBalanceBefore);

      const { permit: permit2, signature: signature2 } = await sign(
        {
          token: C_USDC_V2,
          amount: cUsdcBalanceAfter,
        },
        compound.address
      );

      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      await compound.withdraw(permit2, signature2, USDC);
      // gasUsed: 270k

      expect(await usdc.balanceOf(account.address)).to.gt(
        usdcBalanceBefore.add(minimumAmount)
      );
    });

    it("Should supply ETH and withdraw", async () => {
      const compound = await loadFixture(deploy);

      const fee = 3000n;
      const amount = 10n * 10n ** 17n;
      const minimumAmount = 8n * 10n ** 17n;

      const cEthBalanceBefore = await cEth.balanceOf(account.address);

      await compound.supplyETH(C_ETH, fee, {
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
        compound.address
      );

      const balanceBefore = await account.getBalance();

      await compound.withdrawETH(permit, signature);
      // gasUsed: 201k

      expect(await account.getBalance()).to.gt(
        balanceBefore.add(minimumAmount)
      );
    });

    it("Should supply DAI and withdraw it", async () => {
      const compound = await loadFixture(deploy);

      const amount = 100n * 10n ** 18n;
      const minimumAmount = 95n * 10n ** 18n;

      const { permit: permit1, signature: signature1 } = await sign(
        {
          token: DAI,
          amount,
        },
        compound.address
      );

      const cDaiBalanceBefore = await cDai.balanceOf(account.address);

      await compound.supply(permit1, signature1, C_DAI);

      const cDaiBalanceAfter = await cDai.balanceOf(account.address);

      expect(cDaiBalanceAfter).gt(cDaiBalanceBefore);

      const { permit: permit2, signature: signature2 } = await sign(
        {
          token: C_DAI,
          amount: cDaiBalanceAfter,
        },
        compound.address
      );

      const daiBalanceBefore = await dai.balanceOf(account.address);

      await compound.withdraw(permit2, signature2, DAI);
      // gasUsed: 256k

      expect(await dai.balanceOf(account.address)).to.gt(
        daiBalanceBefore.add(minimumAmount)
      );
    });
  });

  describe("Admin", () => {
    it("Should withdraw money", async () => {
      const comet = await loadFixture(deploy);

      const amount = 10n * 10n ** 18n;

      await account.sendTransaction({
        to: comet.address,
        value: amount,
      });

      const balanceBefore = await account.getBalance();

      await comet.withdrawAdmin();

      expect(await account.getBalance()).to.gt(balanceBefore);
    });
  });
});
