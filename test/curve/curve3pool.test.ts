// Curve3pool
import hardhat from "hardhat";
import { expect } from "chai";
import { ethers } from "hardhat";
import { constants } from "ethers";
import {
  PERMIT2_ADDRESS,
  TokenPermissions,
  SignatureTransfer,
  PermitBatchTransferFrom,
} from "@uniswap/permit2-sdk";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { PermitTransferFrom } from "@uniswap/permit2-sdk/dist/PermitTransferFrom";
import { IERC20 } from "../typechain-types";
import { DAI, USDC, USDT } from "../utils/addresses";

// Using 3pool (DAI - USDC - USDT)
const POOL = "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7";
const POOL_TOKEN = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490";
const WHALE = "0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8";

describe("Curve3Pool (DAI - USDC - USDT)", () => {
  let chainId: number;
  let dai: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let poolToken: IERC20;
  let account: SignerWithAddress;

  const deploy = async () => {
    const Curve3Token = await ethers.getContractFactory("Curve3Token");
    const curve3Token = await Curve3Token.deploy(
      POOL,
      PERMIT2_ADDRESS,
      [DAI, USDC, USDT],
      POOL_TOKEN,
      100
    );

    return curve3Token;
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

  const multiSign = async (permitted: TokenPermissions[], spender: string) => {
    const permit: PermitBatchTransferFrom = {
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

    dai = await ethers.getContractAt("IERC20", DAI);
    usdc = await ethers.getContractAt("IERC20", USDC);
    usdt = await ethers.getContractAt("IERC20", USDT);
    poolToken = await ethers.getContractAt("IERC20", POOL_TOKEN);

    [account] = await ethers.getSigners();
    const whale = await ethers.getSigner(WHALE);

    const amount = 1000n * 10n ** 6n;
    const daiAmount = 1000n * 10n ** 18n;

    await usdc.connect(whale).transfer(account.address, amount);
    await usdt.connect(whale).transfer(account.address, amount);
    await dai.connect(whale).transfer(account.address, daiAmount);

    expect(await usdt.balanceOf(account.address)).to.gte(amount);
    expect(await usdc.balanceOf(account.address)).to.gte(amount);
    expect(await dai.balanceOf(account.address)).to.gte(daiAmount);

    await dai.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await usdc.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await usdt.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await poolToken.approve(PERMIT2_ADDRESS, constants.MaxUint256);
  });

  describe("Add Liquidity", () => {
    it("Adds liquidity only for USDC", async () => {
      const curve = await loadFixture(deploy);

      const amount = 100n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            amount,
            token: USDC,
          },
        ],
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve.addLiquidity(permit, signature, [0, amount, 0], 0, 100, {
        value: 5,
      });
      // gasUsed: 270k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore
      );
    });

    it("Adds liquidity only for DAI", async () => {
      const curve = await loadFixture(deploy);

      const amount = 100n * 10n ** 18n;

      const { permit, signature } = await multiSign(
        [
          {
            amount,
            token: DAI,
          },
        ],
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve.addLiquidity(permit, signature, [amount, 0, 0], 0, 100, {
        value: 5,
      });
      // gasUsed: 243k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore
      );
    });

    it("Adds liquidity only for USDT", async () => {
      const curve = await loadFixture(deploy);

      const amount = 100n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            amount,
            token: USDT,
          },
        ],
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve.addLiquidity(permit, signature, [0, 0, amount], 0, 100, {
        value: 5,
      });
      // gasUsed: 260k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore
      );
    });

    it("Adds liquidity for 2 tokens: USDC - DAI", async () => {
      const curve = await loadFixture(deploy);

      const amount1 = 100n * 10n ** 6n;
      const amount2 = 100n * 10n ** 18n;

      const { permit, signature } = await multiSign(
        [
          {
            amount: amount1,
            token: USDC,
          },
          {
            amount: amount2,
            token: DAI,
          },
        ],
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve.addLiquidity(
        permit,
        signature,
        [amount2, amount1, 0],
        0,
        100,
        {
          value: 5,
        }
      );
      // gasUsed: 305k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore
      );
    });

    it("Adds liquidity for 2 tokens: USDT - DAI", async () => {
      const curve = await loadFixture(deploy);

      const amount1 = 100n * 10n ** 6n;
      const amount2 = 100n * 10n ** 18n;

      const { permit, signature } = await multiSign(
        [
          {
            amount: amount1,
            token: USDT,
          },
          {
            amount: amount2,
            token: DAI,
          },
        ],
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve.addLiquidity(
        permit,
        signature,
        [amount2, 0, amount1],
        0,
        100,
        {
          value: 5,
        }
      );
      // gasUsed: 297k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore
      );
    });

    it("Adds liquidity for 2 tokens: USDC - USDT", async () => {
      const curve = await loadFixture(deploy);

      const amount = 100n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            amount,
            token: USDC,
          },
          {
            amount,
            token: USDT,
          },
        ],
        curve.address
      );

      await curve.addLiquidity(permit, signature, [0, amount, amount], 0, 100, {
        value: 5,
      });
      // gasUsed: 318k
    });

    it("Adds liquidity for 3 tokens: DAI - USDC - USDT", async () => {
      const curve = await loadFixture(deploy);

      const amount1 = 100n * 10n ** 18n;
      const amount2 = 100n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            amount: amount1,
            token: DAI,
          },
          {
            amount: amount2,
            token: USDC,
          },
          {
            amount: amount2,
            token: USDT,
          },
        ],
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve.addLiquidity(
        permit,
        signature,
        [amount1, amount2, amount2],
        0,
        100,
        {
          value: 5,
        }
      );
      // gasUsed: 359k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore
      );
    });
  });

  describe("Remove Liquidity", () => {
    it("Should add_liquidity for 2 tokens and remove_liquidity", async () => {
      const curve = await loadFixture(deploy);

      const amount1 = 100n * 10n ** 2n;
      const amount2 = 100n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            amount: amount1,
            token: DAI,
          },
          {
            amount: amount2,
            token: USDC,
          },
        ],
        curve.address
      );

      await curve.addLiquidity(
        permit,
        signature,
        [amount1, amount2, 0],
        0,
        100,
        {
          value: 5,
        }
      );
      // gasUsed: 302k

      const poolBalance = await poolToken.balanceOf(account.address);

      expect(poolBalance).to.be.gte(1n * 10n ** 18n);

      const { permit: permit2, signature: signature2 } = await sign(
        {
          token: POOL_TOKEN,
          amount: poolBalance,
        },
        curve.address
      );

      const daiBalanceBefore = await dai.balanceOf(account.address);
      const usdcBalanceBefore = await usdc.balanceOf(account.address);

      await curve.removeLiquidity(permit2, signature2, [1000, 100000, 0], {
        value: 5,
      });
      // gasUsed: 279k

      expect(await usdc.balanceOf(account.address)).to.be.gt(usdcBalanceBefore);
      expect(await dai.balanceOf(account.address)).to.be.gt(daiBalanceBefore);
    });

    it("Should add_liquidity for 2 tokens and remove_one_coin", async () => {
      const curve = await loadFixture(deploy);

      const amount = 100n * 10n ** 6n;

      const { permit, signature } = await multiSign(
        [
          {
            amount,
            token: USDT,
          },
          {
            amount,
            token: USDC,
          },
        ],
        curve.address
      );

      await curve.addLiquidity(permit, signature, [0, amount, amount], 0, 100, {
        value: 5,
      });
      // gasUsed: 318k

      const poolBalance = await poolToken.balanceOf(account.address);

      expect(poolBalance).to.be.gte(1n * 10n ** 18n);

      const { permit: permit2, signature: signature2 } = await sign(
        {
          token: POOL_TOKEN,
          amount: poolBalance,
        },
        curve.address
      );

      const daiBalanceBefore = await dai.balanceOf(account.address);

      await curve.removeLiquidityOneCoinI(permit2, signature2, 0, 0, {
        value: 5,
      });
      // gasUsed: 187k

      expect(await dai.balanceOf(account.address)).to.be.gte(daiBalanceBefore);
    });
  });

  describe("Admin", () => {
    it("Should withdraw money", async () => {
      const curve = await loadFixture(deploy);

      const amount = 10n * 10n ** 18n;

      await account.sendTransaction({
        to: curve.address,
        value: amount,
      });

      const balanceBefore = await account.getBalance();

      await curve.withdrawAdmin();

      expect(await account.getBalance()).to.gt(balanceBefore);
    });
  });
});
