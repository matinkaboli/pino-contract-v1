// SPDX-License-Identifier: MIT
pragma solidity =0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface Pool {
  function calc_token_amount(uint256[] memory amounts, bool deposit) view external returns (uint256);
  function coins(uint256) view external returns (address);
  function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) external;
  function add_liquidity(uint256[3] memory amounts, uint256 min_mint_amount) external;
  function remove_liquidity(uint256 _amount, uint256[3] memory min_amounts) external;
  function get_dy(int128 i, int128 j, uint256 dx) view external returns (uint256);
}

/// @title Curve proxy contract 
/// @author Matin Kaboli
/// @notice Add/Remove liquidity, and exchange tokens in a pool
/// @dev works for different pools, but use with caution (tested only for StableSwap)
contract Curve3Token is Ownable {
  using SafeERC20 for IERC20;

  address[3] public tokens;
  address immutable public pool;
  address immutable public token;

  /// @notice Receives ERC20 tokens and Curve pool address and saves them
  /// @param _pool Address of Curve pool
  /// @param _tokens Addresses of ERC20 tokens inside the _pool
  /// @param _token Address of pool token
  constructor(address _pool, address[3] memory _tokens, address _token) {
    pool = _pool;
    token = _token;
    tokens = _tokens;

    IERC20(tokens[0]).safeApprove(_pool, type(uint).max);
    IERC20(tokens[1]).safeApprove(_pool, type(uint).max);
    IERC20(tokens[2]).safeApprove(_pool, type(uint).max);
  }

  /// @notice Adds liquidity to a pool
  /// @param _amounts Amounts of the tokens respectively
  /// @param _minMintAmount Minimum liquidity expected to receive after adding liquidity
  function addLiquidity(uint256[3] memory _amounts, uint256 _minMintAmount) public payable {
    for (uint8 i = 0; i < 3; i += 1) {
      if (_amounts[i] > 0) {
        IERC20(tokens[i]).safeTransferFrom(msg.sender, address(this), _amounts[i]);
      }
    }

    Pool(pool).add_liquidity(_amounts, _minMintAmount);
  }

  /// @notice Removes liquidity from the pool
  /// @param liquidity Amount of liquidity to withdraw
  /// @param minAmounts Minimum amounts expected to receive after withdrawal
  function removeLiquidity(uint liquidity, uint[3] memory minAmounts) public payable {
    IERC20(token).transferFrom(msg.sender, address(this), liquidity);
    Pool(pool).remove_liquidity(liquidity, minAmounts);
  }

  /// @notice Exchanges 2 tokens in a pool
  /// @param _i Index of the token sent to swap
  /// @param j Index of the token expected to receive
  /// @param dx Amount of token[i] to send to the pool to swap
  /// @param minDy Minimum amount of token[j] expected to receive
  function exchange(int128 _i, int128 j, uint dx, uint minDy) public payable {
    uint8 i = 0; 

    if (_i == 1) {
      i = 1;
    }

    IERC20(tokens[i]).safeTransferFrom(msg.sender, address(this), dx);

    Pool(pool).exchange(_i, j, dx, minDy);
  }

  /// @notice Withdraws fees and transfers them to owner
  function withdrawAdmin() public onlyOwner {
    require(address(this).balance > 0);

    payable(owner()).transfer(address(this).balance);
  }
}
