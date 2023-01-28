// Curve3pool
import hardhat from "hardhat";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, constants } from "ethers";
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
import { USDT, WBTC, WETH } from "../utils/addresses";

// Using tricrypto2 (USDT - WBTC - ETH)
const POOL = "0xd51a44d3fae010294c616388b506acda1bfaae46";
const POOL_TOKEN = "0xc4ad29ba4b3c580e6d59105fff484999997675ff";
const WHALE = "0xbd9b34ccbb8db0fdecb532b1eaf5d46f5b673fe8";
const WBTC_WHALE = "0x845cbcb8230197f733b59cfe1795f282786f212c";

describe("Curve3Pool (USDT, WBTC, ETH)", () => {
  let chainId: number;
  let usdt: IERC20;
  let wbtc: IERC20;
  let weth: Contract;
  let poolToken: IERC20;
  let account: SignerWithAddress;

  const deploy = async () => {
    const Curve3Token = await ethers.getContractFactory("Curve3Token");
    const curve3Token = await Curve3Token.deploy(
      POOL,
      PERMIT2_ADDRESS,
      [USDT, WBTC, WETH],
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
    await hardhat.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WBTC_WHALE],
    });

    [account] = await ethers.getSigners();
    const whale = await ethers.getSigner(WHALE);
    const wbtcWhale = await ethers.getSigner(WBTC_WHALE);

    weth = await ethers.getContractAt("IWETH9", WETH);
    usdt = await ethers.getContractAt("IERC20", USDT);
    wbtc = await ethers.getContractAt("IERC20", WBTC);
    poolToken = await ethers.getContractAt("IERC20", POOL_TOKEN);

    const usdtAmount = 1000n * 10n ** 6n;
    const wbtcAmount = 1000n * 10n ** 8n;
    const ethAmount = 1000n * 10n ** 18n;

    await usdt.connect(whale).transfer(account.address, usdtAmount);
    await wbtc.connect(wbtcWhale).transfer(account.address, wbtcAmount);
    await weth.connect(account).deposit({
      value: ethAmount,
    });

    expect(await weth.balanceOf(account.address)).to.gte(ethAmount);
    expect(await usdt.balanceOf(account.address)).to.gte(usdtAmount);
    expect(await wbtc.balanceOf(account.address)).to.gte(wbtcAmount);

    await usdt.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await wbtc.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await weth.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await poolToken.approve(PERMIT2_ADDRESS, constants.MaxUint256);
  });

  describe("Add Liquidity", () => {
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

      await curve.addLiquidity(permit, signature, [amount, 0, 0], 0, 100, {
        value: 5,
      });
      // gasUsed: 315k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore
      );
    });

    it("Adds liquidity only for WBTC", async () => {
      const curve = await loadFixture(deploy);

      const amount = 100n * 10n ** 8n;

      const { permit, signature } = await multiSign(
        [
          {
            amount,
            token: WBTC,
          },
        ],
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve.addLiquidity(permit, signature, [0, amount, 0], 0, 100, {
        value: 5,
      });
      // gasUsed: 328k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore
      );
    });

    it("Adds liquidity only for WETH", async () => {
      const curve = await loadFixture(deploy);

      const amount = 100n * 10n ** 18n;

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      const { permit, signature } = await multiSign(
        [
          {
            amount,
            token: WETH,
          },
        ],
        curve.address
      );

      await curve.addLiquidity(permit, signature, [0, 0, amount], 0, 100, {
        value: 5,
      });
      // gasUsed: 296k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore
      );
    });

    it("Adds liquidity for USDT + WBTC", async () => {
      const curve = await loadFixture(deploy);

      const amount1 = 100n * 10n ** 6n;
      const amount2 = 100n * 10n ** 8n;

      const { permit, signature } = await multiSign(
        [
          {
            amount: amount1,
            token: USDT,
          },
          {
            amount: amount2,
            token: WBTC,
          },
        ],
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

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
      // gasUsed: 447k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore
      );
    });

    it("Adds liquidity for USDT + WETH", async () => {
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
            token: WETH,
          },
        ],
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve.addLiquidity(
        permit,
        signature,
        [amount1, 0, amount2],
        0,
        100,
        {
          value: 5,
        }
      );
      // gasUsed: 384k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore
      );
    });

    it("Adds liquidity for WBTC + WETH", async () => {
      const curve = await loadFixture(deploy);

      const amount1 = 100n * 10n ** 8n;
      const amount2 = 100n * 10n ** 18n;

      const { permit, signature } = await multiSign(
        [
          {
            amount: amount1,
            token: WBTC,
          },
          {
            amount: amount2,
            token: WETH,
          },
        ],
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve.addLiquidity(
        permit,
        signature,
        [0, amount1, amount2],
        0,
        100,
        {
          value: 5,
        }
      );
      // gasUsed: 432k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore
      );
    });

    it("Adds liquidity for USDT + WBTC + WETH", async () => {
      const curve = await loadFixture(deploy);

      const amount1 = 100n * 10n ** 6n;
      const amount2 = 100n * 10n ** 8n;
      const amount3 = 100n * 10n ** 18n;

      const { permit, signature } = await multiSign(
        [
          {
            amount: amount1,
            token: USDT,
          },
          {
            amount: amount2,
            token: WBTC,
          },
          {
            amount: amount2,
            token: WETH,
          },
        ],
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve.addLiquidity(
        permit,
        signature,
        [amount1, amount2, amount3],
        0,
        100,
        {
          value: 5,
        }
      );
      // gasUsed: 232k

      expect(await poolToken.balanceOf(account.address)).to.be.gt(
        poolTokenBalanceBefore
      );
    });
  });

  describe("Remove Liquidity", () => {
    it("Should add liquidity and remove liquidity", async () => {
      const curve = await loadFixture(deploy);

      const amount = 100n * 10n ** 8n;

      const { permit, signature } = await multiSign(
        [
          {
            amount,
            token: WBTC,
          },
        ],
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve.addLiquidity(permit, signature, [0, amount, 0], 0, 100, {
        value: 5,
      });
      // gasUsed: 328k

      const poolTokenBalanceAfter = await poolToken.balanceOf(account.address);

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);

      const { permit: permit2, signature: signature2 } = await sign(
        {
          token: POOL_TOKEN,
          amount: poolTokenBalanceAfter,
        },
        curve.address
      );

      const usdtBalanceBefore = await usdt.balanceOf(account.address);
      const wbtcBalanceBefore = await wbtc.balanceOf(account.address);
      const wethBalanceBefore = await weth.balanceOf(account.address);

      await curve.removeLiquidity(permit2, signature2, [0, 0, 0]);
      // 259k

      expect(await usdt.balanceOf(account.address)).to.gt(usdtBalanceBefore);
      expect(await wbtc.balanceOf(account.address)).to.gt(wbtcBalanceBefore);
      expect(await weth.balanceOf(account.address)).to.gt(wethBalanceBefore);
    });

    it("Should add liquidity and remove liquidity one coin", async () => {
      const curve = await loadFixture(deploy);

      const amount = 100n * 10n ** 8n;

      const { permit, signature } = await multiSign(
        [
          {
            amount,
            token: WBTC,
          },
        ],
        curve.address
      );

      const poolTokenBalanceBefore = await poolToken.balanceOf(account.address);

      await curve
        .connect(account)
        .addLiquidity(permit, signature, [0, amount, 0], 0, 100, {
          value: 100,
        });

      const poolTokenBalanceAfter = await poolToken.balanceOf(account.address);

      expect(poolTokenBalanceAfter).to.be.gt(poolTokenBalanceBefore);

      const { permit: permit2, signature: signature2 } = await sign(
        {
          token: POOL_TOKEN,
          amount: poolTokenBalanceAfter,
        },
        curve.address
      );

      const usdtBalanceBefore = await usdt.balanceOf(account.address);

      await curve.removeLiquidityOneCoinU(permit2, signature2, 2, 0);
      // gasUsed: 285k

      expect(await usdt.balanceOf(account.address)).to.gte(usdtBalanceBefore);
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
