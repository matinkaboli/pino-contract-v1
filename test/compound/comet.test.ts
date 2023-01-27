// Comet
import hardhat from "hardhat";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, constants } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import {
  PERMIT2_ADDRESS,
  TokenPermissions,
  SignatureTransfer,
} from "@uniswap/permit2-sdk";
import { PermitTransferFrom } from "@uniswap/permit2-sdk/dist/PermitTransferFrom";

import { IERC20 } from "../../typechain-types";
import wethInterface from "../utils/wethInterface.json";
import cometInterface from "../utils/cometInterface.json";
import { USDC, C_USDC, LINK, COMP, WETH, UNI, WBTC } from "../utils/addresses";

const WHALE = "0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8";
const WBTC_WHALE = "0x845cbcb8230197f733b59cfe1795f282786f212c";

describe("Comet (Compound V3)", () => {
  let chainId: number;
  let usdc: IERC20;
  let wbtc: IERC20;
  let cUsdc: IERC20;
  let weth: Contract;
  let cometContract: Contract;
  let account: SignerWithAddress;
  let otherAccount: SignerWithAddress;

  const deploy = async () => {
    const Comet = await ethers.getContractFactory("Comet");
    const comet = await Comet.connect(account).deploy(
      C_USDC,
      WETH,
      PERMIT2_ADDRESS,
      [USDC, WETH, WBTC]
    );

    return comet;
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

    [account, otherAccount] = await ethers.getSigners();
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

    await usdc.connect(whale).transfer(account.address, amount);
    await wbtc.connect(wbtcWhale).transfer(account.address, wbtcAmount);
    await weth.connect(account).deposit({
      value: ethAmount,
    });

    const usdcBalance = await usdc.balanceOf(account.address);
    const wbtcBalance = await wbtc.balanceOf(account.address);
    const wethBalance = await weth.balanceOf(account.address);

    expect(usdcBalance).to.gte(amount);
    expect(wethBalance).to.gte(ethAmount);
    expect(wbtcBalance).to.gte(wbtcAmount);

    await usdc.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await wbtc.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await cUsdc.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await weth.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
  });

  describe("Deployment", () => {
    it("Should deploy with 0 tokens", async () => {
      const Comet = await ethers.getContractFactory("Comet");

      await Comet.connect(account).deploy(C_USDC, WETH, PERMIT2_ADDRESS, []);
    });

    it("Should deploy with multiple tokens", async () => {
      const Comet = await ethers.getContractFactory("Comet");

      await Comet.connect(account).deploy(C_USDC, WETH, PERMIT2_ADDRESS, [
        USDC,
        WETH,
      ]);
    });

    it("Should deploy with all comet tokens", async () => {
      const Comet = await ethers.getContractFactory("Comet");

      await Comet.connect(account).deploy(C_USDC, WETH, PERMIT2_ADDRESS, [
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

      const { permit, signature } = await sign(
        {
          token: USDC,
          amount,
        },
        comet.address
      );

      const cUsdcBalanceBefore = await cUsdc.balanceOf(account.address);

      await comet.supply(permit, signature);
      // gasUsed: 170k

      expect(await cUsdc.balanceOf(account.address)).to.gt(
        cUsdcBalanceBefore.add(minimumAmount)
      );
    });

    it("Should supply WETH", async () => {
      const comet = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      const { permit, signature } = await sign(
        {
          token: WETH,
          amount,
        },
        comet.address
      );

      await comet.supply(permit, signature);
      // gasUsed: 159k

      const collateralBalance = await cometContract.collateralBalanceOf(
        account.address,
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
        account.address,
        WETH
      );

      expect(collateralBalance).to.gte(amount);
    });

    it("Should supply WBTC", async () => {
      const comet = await loadFixture(deploy);

      const amount = 500n * 10n ** 8n;

      const { permit, signature } = await sign(
        {
          token: WBTC,
          amount,
        },
        comet.address
      );

      await comet.supply(permit, signature);
      // gasUsed: 168k

      const collateralBalance = await cometContract.collateralBalanceOf(
        account.address,
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

      const cUsdcBalanceBefore = await cUsdc.balanceOf(account.address);

      const { permit, signature } = await sign(
        {
          token: USDC,
          amount,
        },
        comet.address
      );

      await comet.supply(permit, signature);

      const cUsdcBalanceAfter = await cUsdc.balanceOf(account.address);

      expect(cUsdcBalanceAfter).to.gt(cUsdcBalanceBefore.add(minimumAmount));

      await cometContract.connect(account).allow(comet.address, true);
      // gasUsed: 57k

      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      await comet.withdraw(USDC, cUsdcBalanceAfter);
      // gasUsed: 92k

      const usdcBalanceAfter = await usdc.balanceOf(account.address);

      expect(usdcBalanceAfter).to.gt(usdcBalanceBefore);
    });

    it("Should supply WBTC and withdraw it", async () => {
      const comet = await loadFixture(deploy);

      const amount = 5n * 10n ** 8n;

      const { permit, signature } = await sign(
        {
          token: WBTC,
          amount,
        },
        comet.address
      );

      await comet.supply(permit, signature);
      // gasUsed: 160k

      const collateralBalance = await cometContract.collateralBalanceOf(
        account.address,
        WBTC
      );

      expect(collateralBalance).to.gte(amount);

      await cometContract.connect(account).allow(comet.address, true);
      // gasUsed: 57k

      const wbtcBalanceBefore = await wbtc.balanceOf(account.address);

      await comet.withdraw(WBTC, collateralBalance);
      // gasUsed: 92k

      expect(await wbtc.balanceOf(account.address)).to.gt(wbtcBalanceBefore);
    });

    it("Should supply WETH and withdraw it", async () => {
      const comet = await loadFixture(deploy);

      const amount = 500n * 10n ** 8n;

      const { permit, signature } = await sign(
        {
          token: WETH,
          amount,
        },
        comet.address
      );

      await comet.supply(permit, signature);
      // gasUsed: 160k

      const collateralBalance = await cometContract.collateralBalanceOf(
        account.address,
        WETH
      );

      expect(collateralBalance).to.gte(amount);

      await cometContract.connect(account).allow(comet.address, true);
      // gasUsed: 57k

      const wethBalanceBefore = await weth.balanceOf(account.address);

      await comet.connect(account).withdraw(WETH, collateralBalance);
      // gasUsed: 92k

      const wethBalanceAfter = await weth.balanceOf(account.address);

      expect(wethBalanceAfter).to.gt(wethBalanceBefore);
    });

    it("Should supply WETH and withdraw ETH", async () => {
      const comet = await loadFixture(deploy);

      const amount = 20n * 10n ** 16n;
      const minimumAmount = 17n * 10n ** 16n;

      const { permit, signature } = await sign(
        {
          token: WETH,
          amount,
        },
        comet.address
      );

      await comet.supply(permit, signature);
      // gasUsed: 160k

      const collateralBalance = await cometContract.collateralBalanceOf(
        account.address,
        WETH
      );

      expect(collateralBalance).to.gte(amount);

      await cometContract.connect(account).allow(comet.address, true);
      // gasUsed: 57k

      const balanceBefore = await ethers.provider.getBalance(account.address);

      await comet.connect(account).withdrawETH(collateralBalance);
      // gasUsed: 93k

      const balanceAfter = await ethers.provider.getBalance(account.address);

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
        account.address,
        WETH
      );

      expect(collateralBalance).to.gte(amount);

      await cometContract.connect(account).allow(comet.address, true);
      // gasUsed: 57k

      const balanceBefore = await account.getBalance();

      await comet.connect(account).withdrawETH(collateralBalance);
      // gasUsed: 93k

      expect(await account.getBalance()).to.gt(
        balanceBefore.add(minimumAmount)
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

      const balanceAfter = await account.getBalance();

      expect(balanceAfter).to.gt(balanceBefore);
    });
  });
});
