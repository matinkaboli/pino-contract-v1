// SPDX-License-Identifier: MIT
pragma solidity =0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface Pool {
  function calc_token_amount(uint256[] memory amounts, bool deposit) view external returns (uint256);
  function coins(uint256) view external returns (address);
  function remove_liquidity(uint256 _amount, uint256[2] memory min_amounts, address r) external;
  function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy, address r) external returns (uint);
  function add_liquidity(uint256[2] memory amounts, uint256 min_mint_amount, address r) external returns (uint256);
  function get_dy(int128 i, int128 j, uint256 dx) view external returns (uint256);
}

/// @title Curve proxy contract 
/// @author Matin Kaboli
/// @notice Add/Remove liquidity, and exchange tokens in a pool
/// @dev works for different pools, but use with caution (tested only for StableSwap)
contract Curve2Token is Ownable {
  using SafeERC20 for IERC20;

  address immutable public pool;
  address[2] public tokens;

  /// @notice Receives ERC20 tokens and Curve pool address and saves them
  /// @param _pool Address of Curve pool
  /// @param _tokens Addresses of ERC20 tokens inside the _pool
  constructor(address _pool, address[2] memory _tokens) {
    pool = _pool;

    tokens = _tokens;

    IERC20(tokens[0]).safeApprove(_pool, type(uint).max);
    IERC20(tokens[1]).safeApprove(_pool, type(uint).max);
    IERC20(_pool).safeApprove(_pool, type(uint).max);
  }

  /// @notice Adds liquidity to a pool
  /// @param _amounts Amounts of the tokens respectively
  /// @param _minMintAmount Minimum liquidity expected to receive after adding liquidity
  function addLiquidity(uint256[2] memory _amounts, uint256 _minMintAmount) public payable returns (uint) {
    // for (uint8 i = 0; i < 2; i += 1) {
    //   if (_amounts[i] > 0) {
    //     IERC20(tokens[i]).safeTransferFrom(msg.sender, address(this), _amounts[i]);
    //   }
    // }

    if (_amounts[0] > 0) {
      IERC20(tokens[0]).safeTransferFrom(msg.sender, address(this), _amounts[0]);
    }

    if (_amounts[1] > 0) {
      IERC20(tokens[1]).safeTransferFrom(msg.sender, address(this), _amounts[1]);
    }

    uint a = Pool(pool).add_liquidity(_amounts, _minMintAmount, msg.sender);

    return a;
  }

  /// @notice Removes liquidity from the pool
  /// @param liquidity Amount of liquidity to withdraw
  /// @param minAmounts Minimum amounts expected to receive after withdrawal
  function removeLiquidity(uint liquidity, uint[2] memory minAmounts) public payable {
    IERC20(pool).safeTransferFrom(msg.sender, address(this), liquidity);
    Pool(pool).remove_liquidity(liquidity, minAmounts, msg.sender);
  }

  /// @notice Exchanges 2 tokens in a pool
  /// @param _i Index of the token sent to swap
  /// @param j Index of the token expected to receive
  /// @param dx Amount of token[i] to send to the pool to swap
  /// @param minDy Minimum amount of token[j] expected to receive
  function exchange(int128 _i, int128 j, uint dx, uint minDy) public payable returns (uint) {
    uint8 i = 0; 

    if (_i == 1) {
      i = 1;
    }

    IERC20(tokens[i]).safeTransferFrom(msg.sender, address(this), dx);

    uint liquidity = Pool(pool).exchange(_i, j, dx, minDy, msg.sender);

    return liquidity;
  }
}
