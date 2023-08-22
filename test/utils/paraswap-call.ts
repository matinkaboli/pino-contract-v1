import qs from 'qs';

const chainId = 1;
const api = 'https://apiv5.paraswap.io';
const pricesUrl = `${api}/prices?`;
const transactionsUrl = `${api}/transactions/${chainId}?`;
// const USER_ADDRESS = '0x9e620aaf89227eb5ac7d2a8d5f7ba7923a93102f';

interface ParaswapParams {
  srcToken: string;
  srcDecimals: number;
  destToken: string;
  destDecimals: number;
  amount: string;
  receiver: string;
  userAddress: string;
}

interface ParaswapPricesType extends ParaswapParams {
  userAddress: string;
  side: 'SELL' | 'BUY';
  network: number;
}

interface ParaswapTransactionType {
  srcToken: string;
  srcDecimals: number;
  destToken: string;
  destDecimals: number;
  receiver: string;
  userAddress: string;
  srcAmount: string;
  slippage: number;
  priceRoute: any;
}

const getPrices = async (params: ParaswapPricesType) => {
  const q = qs.stringify(params);

  const data = await fetch(pricesUrl + q).then((res) => res.json());

  return data;
};

const getTransaction = async (params: ParaswapTransactionType) => {
  const query = {
    ignoreChecks: true,
  };

  const q = qs.stringify(query);

  const data = await fetch(transactionsUrl + q, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  }).then((res) => res.json());

  return data;
};

const getTX = async (params: ParaswapParams) => {
  const pricesParams: ParaswapPricesType = {
    ...params,
    side: 'SELL',
    network: 1,
  };

  const router = await getPrices(pricesParams);

  const txParams: ParaswapTransactionType = {
    srcToken: params.srcToken,
    srcDecimals: params.srcDecimals,
    destToken: params.destToken,
    destDecimals: params.destDecimals,
    receiver: params.receiver,
    userAddress: params.userAddress,
    srcAmount: params.amount,
    slippage: 1,
    priceRoute: router.priceRoute,
  };

  const tx = await getTransaction(txParams);

  return tx.data;
};

export default getTX;
