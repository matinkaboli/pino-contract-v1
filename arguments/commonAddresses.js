const { PERMIT2_ADDRESS } = require('@uniswap/permit2-sdk');

const mainnet = {
  WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
};

const arbitrum = {
  WETH: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
};

exports.mainnet = mainnet;
exports.arbitrum = arbitrum;

exports.PERMIT2 = PERMIT2_ADDRESS;

exports.UNISWAP_NFPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
exports.UNISWAP_SWAP_ROUTER =
  '0xE592427A0AEce92De3Edee1F18E0157C05861564';

exports.BALANCER_VAULT = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';

exports.ONE_INCH = '0x1111111254EEB25477B68fb85Ed929f73A960582';
exports.PARASWAP = '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57';
exports.ZERO_X = '0xdef1c0ded9bec7f1a1670819833240f027b25eff';

exports.COMPOUND_C_ETH = '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5';