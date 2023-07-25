const { PERMIT2, mainnet } = require('../commonAddresses');

const WETH_GATEWAY = '0xEFFC18fC3b7eb8E676dac549E0c693ad50D1Ce31';
const LENDING_POOL_V2 = '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9';
const LENDING_POOL_V3 = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';

module.exports = [
  PERMIT2,
  mainnet.WETH,
  LENDING_POOL_V2,
  LENDING_POOL_V3,
  WETH_GATEWAY,
];
