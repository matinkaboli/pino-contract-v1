// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

interface IComptroller {
    function enterMarkets(address[] calldata cTokens) external returns (uint256[] memory);
}
