// SPDX-License-Identifier: MIT
pragma solidity =0.8.16;

import "./Proxy.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface Pool {
  function add_liquidity(uint[2] memory amounts, uint min_mint_amount) external payable;
  function remove_liquidity(uint _amount, uint[2] memory min_amounts) external;
  function remove_liquidity_one_coin(uint _token_amount, uint i, uint _min_amount) external returns (uint);
  function remove_liquidity_one_coin(uint _token_amount, int128 i, uint _min_amount) external returns (uint);
}

/// @title Curve proxy contract 
/// @author Matin Kaboli
/// @notice Add/Remove liquidity, and exchange tokens in a pool
/// @dev works for different pools, but use with caution (tested only for StableSwap)
contract Curve2Token is Proxy {
  using SafeERC20 for IERC20;

  constructor(address _pool, address[] memory _tokens, address _token, uint8 _ethIndex)
    Proxy(_pool, _tokens, _token, _ethIndex) {}

  /// @notice Adds liquidity to a pool
  /// @param _amounts Amounts of the tokens respectively
  /// @param _minMintAmount Minimum liquidity expected to receive after adding liquidity
  function addLiquidity(uint256[2] memory _amounts, uint256 _minMintAmount, uint _fee) public payable {
    uint ethValue = 0;
    uint[2] memory amounts = _amounts;

    amounts[0] = calculateAndRetrieve(0, _amounts[0]);
    amounts[1] = calculateAndRetrieve(1, _amounts[1]);

    if (ethIndex != 100) {
      ethValue = msg.value - _fee;
    }

    uint balanceBefore = IERC20(token).balanceOf(address(this));

    Pool(pool).add_liquidity{ value: ethValue }(amounts, _minMintAmount);

    uint balanceAfter = IERC20(token).balanceOf(address(this));

    IERC20(token).transfer(msg.sender, balanceAfter - balanceBefore);
  }

  /// @notice Removes liquidity from the pool
  /// @param liquidity Amount of liquidity to withdraw
  /// @param minAmounts Minimum amounts expected to receive after withdrawal
  function removeLiquidity(uint liquidity, uint[2] memory minAmounts) public payable {
    IERC20(token).safeTransferFrom(msg.sender, address(this), liquidity);

    uint balance0Before = getBalance(0);
    uint balance1Before = getBalance(1);

    Pool(pool).remove_liquidity(liquidity, minAmounts);

    uint balance0After = getBalance(0);
    uint balance1After = getBalance(1);

    if (balance0After > balance0Before) {
      send(0, balance0After - balance0Before);
    }
    if (balance1After > balance1Before) {
      send(1, balance1After - balance1Before);
    }
  }

  /// @notice Removes liquidity and received only 1 token in return
  /// @dev Use this for those pools that use int128 for _i
  /// @param _amount Amount of LP token to burn
  /// @param _i Index of receiving token in the pool
  /// @param min_amount Minimum amount expected to receive from token[i]
  function removeLiquidityOneCoinI(uint _amount, int128 _i, uint min_amount) public payable {
    uint8 i = 0;
    if (_i == 1) {
      i = 1;
    }

    IERC20(token).safeTransferFrom(msg.sender, address(this), _amount);

    uint balanceBefore = getBalance(i);

    Pool(pool).remove_liquidity_one_coin(_amount, _i, min_amount);

    uint balanceAfter = getBalance(i);

    send(i, balanceAfter - balanceBefore);
  }

  /// @notice Removes liquidity and received only 1 token in return
  /// @dev Use this for those pools that use uint256 for _i
  /// @param _amount Amount of LP token to burn
  /// @param _i Index of receiving token in the pool
  /// @param min_amount Minimum amount expected to receive from token[i]
  function removeLiquidityOneCoinU(uint _amount, uint _i, uint min_amount) public payable {
    uint8 i = 0;
    if (_i == 1) {
      i = 1;
    }

    IERC20(token).safeTransferFrom(msg.sender, address(this), _amount);

    uint balanceBefore = getBalance(i);

    Pool(pool).remove_liquidity_one_coin(_amount, _i, min_amount);

    uint balanceAfter = getBalance(i);

    send(i, balanceAfter - balanceBefore);
  }
}
