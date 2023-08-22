export interface SwapParams {
  src: string; // tokenIn address
  dst: string; // tokenOut address
  amount: string; // Amount must have tokenIn's decimals
  receiver: string; // The address that will receive tokenOut
}

const chainId = 1;
const apiKey = process.env.ONE_INCH_API_KEY;
const apiBaseUrl = `https://api.1inch.dev/swap/v5.2/${chainId}`;

const apiRequestUrl = (methodName: string, queryParams: SwapParams) =>
  `${apiBaseUrl + methodName}?${new URLSearchParams(
    queryParams,
  ).toString()}`;

export const swapQuery = async (swapParams: SwapParams) => {
  const params = {
    ...swapParams,
    slippage: 1,
    from: swapParams.src,
    disableEstimate: true,
    allowPartialFill: true,
  };

  const url = apiRequestUrl('/swap', params);

  const result = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  }).then((res) => res.json());

  return result;
};
