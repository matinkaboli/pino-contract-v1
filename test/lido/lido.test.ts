import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants } from 'ethers';
import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { WETH } from '../utils/addresses';
import { signer } from '../utils/helpers';
import { IERC20, IWETH9 } from '../../typechain-types';

const ILIDO = '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84';

describe('Lido', () => {
  let weth: IWETH9;
  let steth: IERC20;
  let account: SignerWithAddress;

  const deploy = async () => {
    const Lido = await ethers.getContractFactory('Lido');

    const contract = await Lido.deploy(PERMIT2_ADDRESS, ILIDO, WETH);

    return { contract, sign: await signer(account) };
  };

  before(async () => {
    [account] = await ethers.getSigners();

    weth = await ethers.getContractAt('IWETH9', WETH);
    steth = await ethers.getContractAt('IERC20', ILIDO);

    const ethAmount = 3n * 10n ** 18n;

    await weth.deposit({
      value: ethAmount,
    });

    expect(await weth.balanceOf(account.address)).to.gte(ethAmount);

    await weth.approve(PERMIT2_ADDRESS, constants.MaxUint256);
  });

  describe('Deployment', () => {
    it('Should deploy Lido contract', async () => {
      const Lido = await ethers.getContractFactory('Lido');

      const contract = await Lido.deploy(
        PERMIT2_ADDRESS,
        ILIDO,
        WETH,
      );

      expect(await contract.lido()).to.equal(ILIDO);
    });
  });

  describe('Submit', () => {
    it('Should supply ETH and receive stETH', async () => {
      const { contract } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      const stethBalanceBefore = await steth.balanceOf(
        account.address,
      );

      await contract.supply(0, { value: amount });

      const stethBalanceAfter = await steth.balanceOf(
        account.address,
      );

      expect(stethBalanceAfter).to.gt(stethBalanceBefore);
    });

    it('Should supply WETH and receive stETH', async () => {
      const { contract, sign } = await loadFixture(deploy);

      const amount = 1n * 10n ** 18n;

      const { permit, signature } = await sign(
        { token: WETH, amount },
        contract.address,
      );

      const stethBalanceBefore = await steth.balanceOf(
        account.address,
      );

      await contract.supplyWeth(permit, signature);

      const stethBalanceAfter = await steth.balanceOf(
        account.address,
      );

      expect(stethBalanceAfter).to.gt(stethBalanceBefore);
    });
  });
});
