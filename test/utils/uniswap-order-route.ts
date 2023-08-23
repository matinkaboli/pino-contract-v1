import JSBI from 'jsbi';
import { config } from 'dotenv';
import { ethers } from 'ethers';
import {
  SwapType,
  AlphaRouter,
  SwapOptionsSwapRouter02,
} from '@uniswap/smart-order-router';
import {
  Token,
  Percent,
  TradeType,
  CurrencyAmount,
} from '@uniswap/sdk-core';

config();

const provider = new ethers.providers.JsonRpcProvider(
  process.env.FORKING_URL,
);

const router = new AlphaRouter({
  chainId: 1,
  provider,
});

const countDecimals = (x: number) => {
  if (Math.floor(x) === x) {
    return 0;
  }
  return x.toString().split('.')[1].length || 0;
};

export const toReadableAmount = (
  rawAmount: number,
  decimals: number,
): string =>
  JSBI.divide(
    JSBI.BigInt(rawAmount),
    JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimals)),
  ).toString();

export const fromReadableAmount = (
  amount: number,
  decimals: number,
): JSBI => {
  const extraDigits = Math.pow(10, countDecimals(amount));
  const adjustedAmount = amount * extraDigits;

  return JSBI.divide(
    JSBI.multiply(
      JSBI.BigInt(adjustedAmount),
      JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimals)),
    ),
    JSBI.BigInt(extraDigits),
  );
};

export const uniswapRouteInput = async (
  recipient: string,
  amountIn: JSBI,
  tokenIn: Token,
  tokenOut: Token,
) => {
  const options: SwapOptionsSwapRouter02 = {
    recipient,
    slippageTolerance: new Percent(1000, 10_000),
    deadline: Math.floor(Date.now() / 1000 + 1800),
    type: SwapType.SWAP_ROUTER_02,
  };

  const route = await router.route(
    CurrencyAmount.fromRawAmount(tokenIn, amountIn),
    tokenOut,
    TradeType.EXACT_INPUT,
    options,
  );

  if (!route) {
    return null;
  }

  return {
    calldata: route.methodParameters?.calldata,
    to: route.methodParameters?.to,
  };
};

export const uniswapRouteOutput = async (
  recipient: string,
  amountOut: JSBI,
  tokenIn: Token,
  tokenOut: Token,
) => {
  const options: SwapOptionsSwapRouter02 = {
    recipient,
    slippageTolerance: new Percent(1000, 10_000),
    deadline: Math.floor(Date.now() / 1000 + 1800),
    type: SwapType.SWAP_ROUTER_02,
  };

  const route = await router.route(
    CurrencyAmount.fromRawAmount(tokenOut, amountOut),
    tokenIn,
    TradeType.EXACT_OUTPUT,
    options,
  );

  if (!route) {
    return null;
  }

  return {
    calldata: route.methodParameters?.calldata,
    to: route.methodParameters?.to,
  };
};
