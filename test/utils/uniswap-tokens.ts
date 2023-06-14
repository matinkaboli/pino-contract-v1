import { Token } from '@uniswap/sdk-core';
import {
  DAI,
  FRAX,
  LINK,
  LUSD,
  USDC,
  USDT,
  WBTC,
  WETH,
} from './addresses';

export const DAI_TOKEN = new Token(1, DAI, 18, 'DAI', 'DAI');
export const WBTC_TOKEN = new Token(1, WBTC, 8, 'WBTC', 'WBTC');
export const USDC_TOKEN = new Token(1, USDC, 6, 'USDC', 'USDC');
export const USDT_TOKEN = new Token(1, USDT, 6, 'USDT', 'USDT');
export const FRAX_TOKEN = new Token(1, FRAX, 18, 'FRAX', 'FRAX');
export const LINK_TOKEN = new Token(1, LINK, 18, 'LINK', 'LINK');
export const LUSD_TOKEN = new Token(1, LUSD, 18, 'LUSD', 'LUSD');
export const WETH_TOKEN = new Token(1, WETH, 18, 'WETH', 'WETH9');
