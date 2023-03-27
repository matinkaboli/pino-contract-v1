import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants } from 'ethers';
import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  DAI,
  USDC,
  USDT,
  WETH,
  WHALE3POOL,
} from '../utils/addresses';
import { IERC20, IWETH9 } from '../../typechain-types';
import { impersonate, multiSigner, signer } from '../utils/helpers';

const ETH = '0x0000000000000000000000000000000000000000';
const WSTETH = '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0';
const VAULT_ADDRESS = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';

describe('Balancer', () => {
  let dai: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;
  let weth: IWETH9;
  let account: SignerWithAddress;

  const deploy = async () => {
    const Balancer = await ethers.getContractFactory('Balancer');

    const contract = await Balancer.deploy(
      PERMIT2_ADDRESS,
      VAULT_ADDRESS,
      [USDC, USDT, WETH],
    );

    return {
      contract,
      sign: await signer(account),
      multiSign: await multiSigner(account),
    };
  };

  before(async () => {
    const whale = await impersonate(WHALE3POOL);
    [account] = await ethers.getSigners();

    dai = await ethers.getContractAt('IERC20', DAI);
    usdc = await ethers.getContractAt('IERC20', USDC);
    usdt = await ethers.getContractAt('IERC20', USDT);
    weth = await ethers.getContractAt('IWETH9', WETH);

    const amount = 5000n * 10n ** 6n;
    const ethAmount = 3n * 10n ** 18n;
    const daiAmount = 5000n * 10n ** 18n;

    await usdc.connect(whale).transfer(account.address, amount);
    await usdt.connect(whale).transfer(account.address, amount);
    await dai.connect(whale).transfer(account.address, daiAmount);
    await weth.deposit({
      value: ethAmount,
    });

    expect(await usdc.balanceOf(account.address)).to.gte(amount);
    expect(await usdt.balanceOf(account.address)).to.gte(amount);
    expect(await dai.balanceOf(account.address)).to.gte(daiAmount);
    expect(await weth.balanceOf(account.address)).to.gte(ethAmount);

    await dai.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await weth.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await usdc.approve(PERMIT2_ADDRESS, constants.MaxUint256);
    await usdt.approve(PERMIT2_ADDRESS, constants.MaxUint256);
  });

  describe('Deployment', () => {
    it('Should deploy with 0 approved tokens', async () => {
      const Balancer = await ethers.getContractFactory('Balancer');

      await Balancer.deploy(PERMIT2_ADDRESS, VAULT_ADDRESS, []);
    });

    it('Should approve token after deployment', async () => {
      const { contract } = await loadFixture(deploy);

      await contract.approveToken(DAI);

      const allowance = await dai.allowance(
        contract.address,
        VAULT_ADDRESS,
      );

      expect(allowance).to.equal(ethers.constants.MaxUint256);
    });
  });

  describe('Pool Interactions', () => {
    it('Should join ETH_wstETH pool', async () => {
      const { contract } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;
      const poolId =
        '0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080';
      const maxAmountsIn = [0, amount];

      const parameterTypes = ['uint256', 'uint256[]', 'uint256'];
      const parameterValues = [1, maxAmountsIn, 0];
      const userData = ethers.utils.defaultAbiCoder.encode(
        parameterTypes,
        parameterValues,
      );

      const poolContract = await ethers.getContractAt(
        'IERC20',
        '0x32296969ef14eb0c6d29669c550d4a0449130230',
      );

      const bptAmountBefore = await poolContract.balanceOf(
        account.address,
      );

      await contract.joinPoolETH(
        poolId,
        userData,
        [WSTETH, ETH],
        maxAmountsIn,
        0,
        {
          value: amount,
        },
      );

      expect(await poolContract.balanceOf(account.address)).to.gt(
        bptAmountBefore,
      );
    });

    it('Should join USDC_WETH Stable pool', async () => {
      const { contract, multiSign } = await loadFixture(deploy);

      const amount0 = 1000n * 10n ** 6n;
      const amount1 = 1n * 10n ** 18n;

      const poolId =
        '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019';

      const { permit, signature } = await multiSign(
        [
          {
            token: USDC,
            amount: amount0,
          },
          {
            token: WETH,
            amount: amount1,
          },
        ],
        contract.address,
      );

      const parameterTypes = ['uint256', 'uint256[]', 'uint256'];
      const parameterValues = [1, [amount0, amount1], 0];
      const userData = ethers.utils.defaultAbiCoder.encode(
        parameterTypes,
        parameterValues,
      );

      const poolContract = await ethers.getContractAt(
        'IERC20',
        '0x96646936b91d6B9D7D0c47C496AfBF3D6ec7B6f8',
      );

      const bptAmountBefore = await poolContract.balanceOf(
        account.address,
      );

      await contract.joinPool(
        poolId,
        userData,
        [USDC, WETH],
        [amount0, amount1],
        0,
        permit,
        signature,
      );

      expect(await poolContract.balanceOf(account.address)).to.gt(
        bptAmountBefore,
      );
    });
  });
});
