// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface Pool {
  function calc_token_amount(uint256[] memory amounts, bool deposit) view external returns (uint256);
  function coins(uint256) view external returns (address);
  function remove_liquidity(uint256 _amount, uint256[] memory min_amounts) external;
  function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) external returns (uint);
  function add_liquidity(uint256[3] memory amounts, uint256 min_mint_amount) external;
  function get_dy(int128 i, int128 j, uint256 dx) view external returns (uint256);
}

/// @title Curve proxy contract V2
/// @author Matin Kaboli
/// @notice Add/Remove liquidity, and exchange tokens in a pool
/// @dev works for 1 pool at a time, but use with caution (tested only for 3pool and 2pool)
contract Curve2 is Ownable {
  address immutable pool;
  address[3] tokens;

  /// @notice Receives ERC20 tokens and Curve pool address and saves them
  /// @param _pool Address of Curve pool
  /// @param _tokens Addresses of ERC20 tokens inside the _pool
  constructor(address _pool, address[3] memory _tokens) {
    pool = _pool;

    tokens = _tokens;
  }

  /// @notice Approves an ERC20 token beforehand
  /// @param i Index of tokens[i] to approve
  function approve(uint8 i) public {
    IERC20(tokens[uint(i)]).approve(pool, type(uint256).max);
  }

  /// @notice Adds liquidity to a pool
  /// @dev Proxy holds the liquidity itself, not msg.sender
  /// @param _amounts Amounts of the tokens respectively
  /// @param _minMintAmount Minimum liquidity expected to receive after adding liquidity
  function addLiquidity(uint256[3] memory _amounts, uint256 _minMintAmount) public payable {
    for (uint8 i = 0; i < tokens.length; i++) {
      if (_amounts[i] > 0) {
        IERC20(tokens[i]).transferFrom(msg.sender, address(this), _amounts[i]);
      }
    }

    Pool(pool).add_liquidity(_amounts, _minMintAmount);
  }

  /// @notice Withdraws fees and transfers them to owner
  function withdrawAdmin() public onlyOwner {
    require(address(this).balance > 0);

    payable(owner()).transfer(address(this).balance);
  }

  /// @notice Removes liquidity from the pool
  /// @param liquidity Amount of liquidity to withdraw
  /// @param minAmounts Minimum amounts expected to receive after withdrawal
  function removeLiquidity(uint liquidity, uint[] memory minAmounts) public payable {
    Pool(pool).remove_liquidity(liquidity, minAmounts);
  }

  /// @notice Exchanges 2 tokens in a pool
  /// @param i Index of the token sent to swap
  /// @param j Index of the token expected to receive
  /// @param dx Amount of token[i] to send to the pool to swap
  /// @param minDy Minimum amount of token[j] expected to receive
  function exchange(int128 i, int128 j, uint dx, uint minDy) public payable {
    IERC20(tokens[uint(i)]).transferFrom(msg.sender, address(this), dx);
    IERC20(tokens[uint(i)]).approve(pool, dx);

    uint liquidity = Pool(pool).exchange(i, j, dx, minDy);
    
    IERC20(tokens[uint(j)]).transfer(msg.sender, liquidity);
  }
}
