import qs from 'qs';

const API_QUOTE_URL = 'https://api.0x.org/swap/v1/quote';

const headers = {
  '0x-api-key': process.env.ZERO_X_API_KEY,
};

interface ZeroXParams {
  sellToken: string;
  buyToken: string;
  sellAmount: string;
}

const zeroXCall = async (params: ZeroXParams) => {
  const p = qs.stringify(params);

  const quote = await fetch(`${API_QUOTE_URL}?${p}`, {
    headers,
  }).then((y) => y.json());

  return quote?.data;
};

export default zeroXCall;
