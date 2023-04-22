// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ISTETH is IERC20 {
    function sharesOf(address _account) external view returns (uint256);
    function transferShares(address _recipient, uint256 _sharesAmount) external returns (uint256);
}
