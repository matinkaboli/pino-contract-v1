// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface Pool {
  function calc_token_amount(uint256[] memory amounts, bool deposit) view external returns (uint256);
  function coins(uint256) view external returns (address);
  function remove_liquidity(uint256 _amount, uint256[] memory min_amounts) external;
  function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) external returns (uint);
  function add_liquidity(uint256[] memory amounts, uint256 min_mint_amount) external;
  function get_dy(int128 i, int128 j, uint256 dx) view external returns (uint256);
}

/// @title Curve proxy contract 
/// @author Matin Kaboli
/// @notice Add/Remove liquidity, and exchange tokens in a pool
/// @dev works for different pools, but use with caution (tested only for StableSwap)
contract Curve is Ownable {
  address[] private tokens;

  /// @notice Takes ERC20 tokens and approves them beforehand for the pools
  /// @param _tokens Address of ERC20 tokens
  /// @param _pools Address of Curve pool
  constructor(address[] memory _tokens, address[] memory _pools) {
    tokens = _tokens;

    for (uint8 i = 0; i < tokens.length; i += 1) {
      for (uint8 j = 0; j < _pools.length; j += 1) {
        IERC20(tokens[i]).approve(_pools[j], type(uint256).max);
      }
    }
  }

  /// @notice Adds liquidity to a pool
  /// @dev Proxy holds the liquidity itself, not msg.sender
  /// @param pool, Address of the Curve pool
  /// @param _tokens Address of the ERC20 tokens in the pool
  /// @param _amounts Amounts of the tokens respectively
  /// @param _minMintAmount Minimum liquidity expected to receive after adding liquidity
  function addLiquidity(address pool, address[] memory _tokens, uint[] memory _amounts, uint _minMintAmount) public payable {
    for (uint8 i = 0; i < _tokens.length; i += 1) {
      if (_amounts[i] == 0) {
        continue;
      }

      bool isTokenApproved = false;

      for (uint8 j = 0; j < tokens.length; j += 1) {
        if (_tokens[i] == tokens[j]) {
          isTokenApproved = true;          
        }
      }

      if (!isTokenApproved) {
        IERC20(_tokens[i]).approve(pool, type(uint256).max);
      }
    }

    for (uint8 i = 0; i < _tokens.length; i += 1) {
      IERC20(_tokens[i]).transferFrom(msg.sender, address(this), _amounts[i]);
    }

    Pool(pool).add_liquidity(_amounts, _minMintAmount);
  }

  /// @notice Removes liquidity from the pool
  /// @param pool Address of Curve pool
  /// @param liquidity Amount of liquidity to withdraw
  /// @param minAmounts Minimum amounts expected to receive after withdrawal
  function removeLiquidity(address pool, uint liquidity, uint[] memory minAmounts) public payable {
    Pool(pool).remove_liquidity(liquidity, minAmounts);
  }

  /// @notice Exchanges 2 tokens in a pool
  /// @param pool Address of Curve pool
  /// @param i Index of the token sent to swap
  /// @param j Index of the token expected to receive
  /// @param dx Amount of token[i] to send to the pool to swap
  /// @param minDy Minimum amount of token[j] expected to receive
  function exchange(address pool, int128 i, int128 j, uint dx, uint minDy) public payable {
    IERC20(tokens[uint(i)]).transferFrom(msg.sender, address(this), dx);
    IERC20(tokens[uint(i)]).approve(pool, dx);

    uint liquidity = Pool(pool).exchange(i, j, dx, minDy);
    
    IERC20(tokens[uint(j)]).transfer(msg.sender, liquidity);
  }

  /// @notice Withdraws fees and transfers them to owner
  function withdrawAdmin() public onlyOwner {
    require(address(this).balance > 0);

    payable(owner()).transfer(address(this).balance);
  }
}
