import JSBI from 'jsbi';
import BN from 'bignumber.js';
import { config } from 'dotenv';
import { ethers } from 'ethers';
import {
  ChainId,
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
import generateUniswapPath from './generateUniswapPath';

config();

const provider = new ethers.providers.JsonRpcProvider(
  process.env.FORKING_URL,
);

const router = new AlphaRouter({
  chainId: ChainId.MAINNET,
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

export const bigNumberToString = (num: BN): string =>
  BigInt(Number(num.toString())).toString();

export const uniswapOrderRoute = async (
  recipient: string,
  amountIn: JSBI,
  tokenIn: Token,
  tokenOut: Token,
  tradeType: TradeType,
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
    tradeType,
    options,
  );

  if (!route) {
    return null;
  }

  const routes = [];
  const { swaps } = route.trade;

  for (let i = 0; i < swaps.length; i += 1) {
    const inputAmount = new BN(swaps[i].inputAmount.toExact()).times(
      new BN(10).pow(swaps[i].inputAmount.currency.decimals),
    );
    const outputAmount = new BN(
      swaps[i].outputAmount.toExact(),
    ).times(
      new BN(10).pow(swaps[i].outputAmount.currency.decimals - 1),
    );

    const pathBytes = [];
    const { path } = swaps[i].route;

    for (let j = 0; j < path.length; j += 1) {
      pathBytes.push(path[j].address);

      if (swaps[i].route.pools[j]) {
        pathBytes.push(swaps[i].route.pools[j].fee);
      }
    }

    const generatedPath = ethers.utils.solidityPack(
      generateUniswapPath(pathBytes).types,
      generateUniswapPath(pathBytes).values,
    );

    const swapParams = {
      path: generatedPath,
      amountIn: bigNumberToString(inputAmount),
      amountOutMinimum: bigNumberToString(outputAmount),
    };

    routes.push(swapParams);
  }

  return routes;
};
