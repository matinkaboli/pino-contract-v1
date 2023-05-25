import qs from 'qs';

const chainId = 1;
const api = 'https://apiv5.paraswap.io';
const pricesUrl = `${api}/prices?`;
const transactionsUrl = `${api}/transactions/${chainId}`;

interface ParaswapParams {
  amount: string;
  receiver: string;
  srcToken: string;
  destToken: string;
  srcDecimals: number;
  destDecimals: number;
  userAddress: string;
}

const getPrices = async (p: Partial<ParaswapParams>) => {
  const params = {
    srcToken: p.srcToken,
    destToken: p.destToken,
    amount: p.amount,
    srcDecimals: p.srcDecimals,
    destDecimals: p.destDecimals,
    side: 'SELL',
    network: chainId,
  };

  const q = qs.stringify(params);
  const data = await fetch(pricesUrl + q).then((res) => res.json());

  return data;
};

const getTransaction = async (params: Partial<ParaswapParams>) => {
  const data = await fetch(transactionsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  }).then((res) => res.json());

  return data;
};

const getTX = async (p: Partial<ParaswapParams>) => {
  const routerParams = {
    ...p,
  };

  delete routerParams.receiver;
  delete routerParams.userAddress;

  const router = await getPrices(p);

  const txParams = {
    ...p,
    ...router,
    srcAmount: p.amount,
    slippage: 1,
  };

  delete txParams.amount;

  const tx = await getTransaction(txParams);
  return tx.data;
};

export default getTX;

// const params = {
//   userAddress: '0x1E7A7Bb102c04e601dE48a68A88Ec6EE59C372b9',
//   receiver: '0x322520845d8d28F4fFd08676eCc05C33C40aC4cf',
//   srcToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
//   destToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
//   amount: '100000000000000000',
//   srcDecimals: 18,
//   destDecimals: 6,
// };
// getTX(params);
