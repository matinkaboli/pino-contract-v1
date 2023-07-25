const {
  PERMIT2,
  mainnet,
  UNISWAP_NFPM,
  UNISWAP_SWAP_ROUTER,
} = require('../commonAddresses');

module.exports = [
  PERMIT2,
  mainnet.WETH,
  UNISWAP_SWAP_ROUTER,
  UNISWAP_NFPM,
];
