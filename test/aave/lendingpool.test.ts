// LendingPool
import hardhat from "hardhat";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, constants } from "ethers";
import {
  PERMIT2_ADDRESS,
  TokenPermissions,
  SignatureTransfer,
} from "@uniswap/permit2-sdk";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { PermitTransferFrom } from "@uniswap/permit2-sdk/dist/PermitTransferFrom";
import {
  DAI,
  USDC,
  USDT,
  WETH,
  A_DAI,
  A_USDC,
  A_USDT,
  A_WETH,
  tokens,
  aTokens,
} from "../utils/addresses";
import { IERC20 } from "../../typechain-types";
import wethInterface from "../utils/wethInterface.json";

const WHALE = "0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8";
const LENDING_POOL = "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9";
const WETH_GATEWAY = "0xEFFC18fC3b7eb8E676dac549E0c693ad50D1Ce31";

describe("Aave - LendingPool", () => {
  let chainId: number;
  let dai: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let aDai: IERC20;
  let aUsdc: IERC20;
  let aUsdt: IERC20;
  let aWeth: IERC20;
  let weth: Contract;
  let account: SignerWithAddress;
  let otherAccount: SignerWithAddress;

  const deploy = async () => {
    const LendingPool = await ethers.getContractFactory("LendingPool");
    const lendingPool = await LendingPool.connect(account).deploy(
      LENDING_POOL,
      WETH_GATEWAY,
      PERMIT2_ADDRESS,
      [USDC, USDT],
      [A_USDC, A_USDT]
    );

    await lendingPool.connect(account).approveToken(DAI);
    await lendingPool.connect(account).approveToken(WETH);
    await lendingPool.connect(account).approveToken(A_DAI);
    await lendingPool.connect(account).approveToken(A_WETH);
    await lendingPool.connect(account).approveTokenToWethGateway(A_WETH);

    return lendingPool;
  };

  before(async () => {
    const network = await ethers.provider.getNetwork();
    chainId = network.chainId;

    await hardhat.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WHALE],
    });
    const whale = await ethers.getSigner(WHALE);

    [account, otherAccount] = await ethers.getSigners();

    dai = await ethers.getContractAt("IERC20", DAI);
    usdc = await ethers.getContractAt("IERC20", USDC);
    usdt = await ethers.getContractAt("IERC20", USDT);
    aDai = await ethers.getContractAt("IERC20", A_DAI);
    aUsdc = await ethers.getContractAt("IERC20", A_USDC);
    aUsdt = await ethers.getContractAt("IERC20", A_USDT);
    aWeth = await ethers.getContractAt("IERC20", A_WETH);
    weth = new ethers.Contract(WETH, wethInterface, whale);

    const amount = 5000n * 10n ** 6n;
    const ethAmount = 3n * 10n ** 18n;
    const daiAmount = 5000n * 10n ** 18n;

    await usdc.connect(whale).transfer(account.address, amount);
    await usdt.connect(whale).transfer(account.address, amount);
    await dai.connect(whale).transfer(account.address, daiAmount);
    await weth.connect(account).deposit({
      value: ethAmount,
    });

    const daiBalance = await dai.balanceOf(account.address);
    const usdcBalance = await usdc.balanceOf(account.address);
    const usdtBalance = await usdt.balanceOf(account.address);
    const wethBalance = await weth.balanceOf(account.address);

    expect(usdcBalance).to.gte(amount);
    expect(usdtBalance).to.gte(amount);
    expect(daiBalance).to.gte(daiAmount);
    expect(wethBalance).to.gte(ethAmount);

    await dai.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await weth.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await usdc.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await usdt.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);

    await aDai.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await aUsdc.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await aUsdt.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await aWeth.connect(account).approve(PERMIT2_ADDRESS, constants.MaxUint256);
  });

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

  describe.skip("Deployment", () => {
    it("Should deploy with 0 tokens", async () => {
      const LendingPool = await ethers.getContractFactory("LendingPool2");

      await LendingPool.deploy(
        LENDING_POOL,
        WETH_GATEWAY,
        PERMIT2_ADDRESS,
        [],
        []
      );
    });

    it("Should deploy with multiple tokens", async () => {
      const LendingPool = await ethers.getContractFactory("LendingPool2");

      await LendingPool.deploy(
        LENDING_POOL,
        WETH_GATEWAY,
        PERMIT2_ADDRESS,
        [DAI, USDC],
        [A_DAI, A_USDC]
      );
    });

    it("Should deploy with all aave tokens and aTokens", async () => {
      const LendingPool = await ethers.getContractFactory("LendingPool2");

      await LendingPool.deploy(
        LENDING_POOL,
        WETH_GATEWAY,
        PERMIT2_ADDRESS,
        tokens,
        aTokens,
        {
          gasLimit: 10_000_000,
        }
      );
    });
  });

  describe("Supply", () => {
    it("Should supply USDC", async () => {
      const lendingPool = await loadFixture(deploy);

      const amount = 1000n * 10n ** 6n;

      const permitted = {
        amount,
        token: USDC,
      };

      const { signature, permit } = await sign(permitted, lendingPool.address);

      const aUsdcBalance = await aUsdc.balanceOf(account.address);

      await lendingPool.connect(account).deposit(permit, signature);
      // gasUsed: 354k

      expect(await aUsdc.balanceOf(account.address)).to.gt(aUsdcBalance);
    });

    it("Should supply USDT", async () => {
      const lendingPool = await loadFixture(deploy);

      const amount = 1000n * 10n ** 6n;

      const permitted = {
        amount,
        token: USDT,
      };

      const { signature, permit } = await sign(permitted, lendingPool.address);

      const aUsdtBalance = await aUsdt.balanceOf(account.address);

      await lendingPool.connect(account).deposit(permit, signature);
      // gasUsed: 355k

      expect(await aUsdt.balanceOf(account.address)).to.gt(aUsdtBalance);
    });

    it("Should supply DAI", async () => {
      const lendingPool = await loadFixture(deploy);

      const amount = 1000n * 10n ** 18n;

      const permitted = {
        amount,
        token: DAI,
      };

      const { signature, permit } = await sign(permitted, lendingPool.address);

      const aDaiBalance = await aDai.balanceOf(account.address);

      await lendingPool.connect(account).deposit(permit, signature);
      // gasUsed: 355k

      expect(await aDai.balanceOf(account.address)).to.gt(aDaiBalance);
    });

    it("Should supply WETH", async () => {
      const lendingPool = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      const permitted = {
        amount,
        token: WETH,
      };

      const { signature, permit } = await sign(permitted, lendingPool.address);

      const aWethBalance = await aWeth.balanceOf(account.address);

      await lendingPool.connect(account).deposit(permit, signature);
      // gasUsed: 354k

      expect(await aWeth.balanceOf(account.address)).to.gt(aWethBalance);
    });

    it("Should supply ETH directly", async () => {
      const lendingPool = await loadFixture(deploy);

      const fee = 3000n;
      const amount = 10n * 10n ** 18n;
      const minimumAmount = 9n * 10n ** 18n;

      const aWethBalanceBefore = await aWeth.balanceOf(account.address);

      await lendingPool.connect(account).depositETH(fee, {
        value: amount - fee,
      });
      // gasUsed: 293k

      const aWethBalanceAfter = await aWeth.balanceOf(account.address);

      expect(aWethBalanceAfter).to.gte(aWethBalanceBefore.add(minimumAmount));
    });
  });

  describe("Withdraw", () => {
    it("Should supply USDC and withdraw it", async () => {
      const lendingPool = await loadFixture(deploy);

      const amount = 100n * 10n ** 6n;
      const minimumAmount = 98n * 10n ** 6n;

      const permitted1 = {
        amount,
        token: USDC,
      };

      const { signature, permit } = await sign(permitted1, lendingPool.address);

      const aUsdcBalanceBefore = await aUsdc.balanceOf(account.address);

      await lendingPool.deposit(permit, signature);
      // gasUsed: 354k

      const aUsdcBalanceAfter = await aUsdc.balanceOf(account.address);

      expect(aUsdcBalanceAfter).to.gt(aUsdcBalanceBefore);

      const permitted2 = {
        token: A_USDC,
        amount: aUsdcBalanceAfter,
      };

      const { signature: signature2, permit: permit2 } = await sign(
        permitted2,
        lendingPool.address
      );

      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      await lendingPool.connect(account).withdraw(permit2, signature2, USDC);
      // gasUsed: 379k

      const usdcBalanceAfter = await usdc.balanceOf(account.address);

      expect(usdcBalanceAfter).to.gt(usdcBalanceBefore.add(minimumAmount));
    });

    it("Should supply DAI and withdraw it after 1 year", async () => {
      const lendingPool = await loadFixture(deploy);

      const amount = 100n * 10n ** 18n;
      const minimumAmount = 101n * 10n ** 18n;

      const permitted1 = {
        amount,
        token: DAI,
      };

      const { signature, permit } = await sign(permitted1, lendingPool.address);

      const aDaiBalanceBefore = await aDai.balanceOf(account.address);

      await lendingPool.deposit(permit, signature);
      // gasUsed: 355k

      const aDaiBalanceAfter = await aDai.balanceOf(account.address);

      expect(aDaiBalanceAfter).to.gt(aDaiBalanceBefore);

      // Increate the time to 2 years to get some APY
      const TWO_YEAR_AFTER = 60 * 60 * 24 * 365 * 2;
      const now = await time.latest();
      await time.increaseTo(now + TWO_YEAR_AFTER);

      const aDaiBalanceAfter2 = await aDai.balanceOf(account.address);

      const permitted2 = {
        token: A_DAI,
        amount: aDaiBalanceAfter2,
      };

      const { signature: signature2, permit: permit2 } = await sign(
        permitted2,
        lendingPool.address
      );

      const daiBalanceBefore = await dai.balanceOf(account.address);

      await lendingPool.connect(account).withdraw(permit2, signature2, DAI);
      // gasUsed: 420k

      const daiBalanceAfter = await dai.balanceOf(account.address);

      expect(daiBalanceAfter).to.gt(daiBalanceBefore.add(minimumAmount));
    });

    it("Should supply WETH and withdraw it", async () => {
      const lendingPool = await loadFixture(deploy);

      const amount = 2n * 10n ** 18n;
      const minimumAmount = 1n * 10n ** 18n;

      const permitted1 = {
        amount,
        token: WETH,
      };

      const { signature, permit } = await sign(permitted1, lendingPool.address);

      const aWethBalanceBefore = await aWeth.balanceOf(account.address);

      await lendingPool.deposit(permit, signature);
      // gasUsed: 354k

      const aWethBalanceAfter = await aWeth.balanceOf(account.address);

      expect(aWethBalanceAfter).to.gt(aWethBalanceBefore);

      const permitted2 = {
        amount: aWethBalanceAfter,
        token: A_WETH,
      };

      const { signature: signature2, permit: permit2 } = await sign(
        permitted2,
        lendingPool.address
      );

      const wethBalanceBefore = await weth.balanceOf(account.address);

      await lendingPool.connect(account).withdraw(permit2, signature2, WETH);
      // gasUsed: 402k

      const wethBalanceAfter = await weth.balanceOf(account.address);

      expect(wethBalanceAfter).to.gt(wethBalanceBefore.add(minimumAmount));
    });

    it("Should supply ETH directly and withdraw ETH", async () => {
      const lendingPool = await loadFixture(deploy);

      const fee = 3000n;
      const amount = 10n * 10n ** 18n;
      const minimumAmount = 9n * 10n ** 18n;

      const aWethBalanceBefore = await aWeth.balanceOf(account.address);

      await lendingPool.connect(account).depositETH(fee, {
        value: amount - fee,
      });
      // gasUsed: 293k

      const aWethBalanceAfter = await aWeth.balanceOf(account.address);

      expect(aWethBalanceAfter).to.gte(aWethBalanceBefore.add(minimumAmount));

      const balanceBefore = await account.getBalance();

      const permitted1 = {
        amount: aWethBalanceAfter,
        token: A_WETH,
      };

      const { signature, permit } = await sign(permitted1, lendingPool.address);

      await lendingPool.connect(account).withdrawETH(permit, signature);
      // gasUsed: 487k

      const balanceAfter = await account.getBalance();

      expect(balanceAfter).to.gt(balanceBefore.add(minimumAmount));
    });

    it("Should supply ETH directly and withdraw WETH", async () => {
      const lendingPool = await loadFixture(deploy);

      const fee = 3000n;
      const amount = 10n * 10n ** 18n;
      const minimumAmount = 9n * 10n ** 18n;

      const aWethBalanceBefore = await aWeth.balanceOf(account.address);

      await lendingPool.connect(account).depositETH(fee, {
        value: amount - fee,
      });
      // gasUsed: 293k

      const aWethBalanceAfter = await aWeth.balanceOf(account.address);

      expect(aWethBalanceAfter).to.gte(aWethBalanceBefore.add(minimumAmount));

      const wethBalanceBefore = await weth.balanceOf(account.address);

      const permitted = {
        token: A_WETH,
        amount: aWethBalanceAfter,
      };

      const { permit, signature } = await sign(permitted, lendingPool.address);

      await lendingPool.connect(account).withdraw(permit, signature, WETH);
      // gasUsed: 402k

      const wethBalanceAfter = await weth.balanceOf(account.address);

      expect(wethBalanceAfter).to.gt(wethBalanceBefore.add(minimumAmount));
    });
  });

  describe("Admin", () => {
    it("Should change lending pool address", async () => {
      const lendingPool = await loadFixture(deploy);

      const newLendingPoolAddress =
        "0xc6845a5c768bf8d7681249f8927877efda425baf";

      await lendingPool
        .connect(account)
        .changeLendingPoolAddress(newLendingPoolAddress);

      const currentOwner = await lendingPool.lendingPool();

      expect(currentOwner).to.hexEqual(newLendingPoolAddress);
    });

    it("Should revert when trying to change lending pool address (not using owner)", async () => {
      const lendingPool = await loadFixture(deploy);

      const newLendingPoolAddress =
        "0xc6845a5c768bf8d7681249f8927877efda425baf";

      await expect(
        lendingPool
          .connect(otherAccount)
          .changeLendingPoolAddress(newLendingPoolAddress)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should withdraw money", async () => {
      const lendingPool = await loadFixture(deploy);

      const amount = 10n * 10n ** 18n;

      await account.sendTransaction({
        to: lendingPool.address,
        value: amount,
      });

      const balanceBefore = await account.getBalance();

      await lendingPool.withdrawAdmin();

      const balanceAfter = await account.getBalance();

      expect(balanceAfter).to.gt(balanceBefore);
    });
  });
});
