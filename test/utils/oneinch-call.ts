// import fetch from 'node-fetch';

export interface SwapParams {
  amount: string;
  slippage: number;
  fromAddress: string;
  destReceiver: string;
  toTokenAddress: string;
  fromTokenAddress: string;
  disableEstimate: boolean;
  allowPartialFill: boolean;
}

const chainId = 1;
const apiBaseUrl = `https://api.1inch.io/v5.0/${chainId}`;

const apiRequestUrl = (methodName: string, queryParams: SwapParams) =>
  `${apiBaseUrl + methodName}?${new URLSearchParams(
    queryParams,
  ).toString()}`;

export const swapQuery = async (swapParams: SwapParams) => {
  const url = apiRequestUrl('/swap', swapParams);

  const result = await fetch(url).then((res) => res.json());

  return result;
};
