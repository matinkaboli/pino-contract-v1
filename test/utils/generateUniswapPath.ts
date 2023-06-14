import BN from 'bignumber.js';
import { ethers } from 'ethers';

const generatePath = (
  pathSplitted: string[],
): { types: string[]; values: (string | number)[] } => {
  const generatedPathTypes = [];
  const generatedPathValues = [];

  for (let i = 0; i < pathSplitted.length; i += 1) {
    if (ethers.utils.isAddress(pathSplitted[i])) {
      generatedPathTypes.push('address');
      generatedPathValues.push(pathSplitted[i]);
    } else {
      generatedPathTypes.push('uint24');
      generatedPathValues.push(pathSplitted[i]);
    }
  }

  return {
    types: generatedPathTypes,
    values: generatedPathValues,
  };
};

export default generatePath;
