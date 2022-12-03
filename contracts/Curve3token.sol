// SPDX-License-Identifier: MIT
pragma solidity =0.8.16;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface Pool {
  function add_liquidity(uint[3] memory amounts, uint min_mint_amount) external;
  function remove_liquidity(uint _amount, uint[3] memory min_amounts) external;
  function remove_liquidity_one_coin(uint _token_amount, uint i, uint _min_amount) external returns (uint);
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
    IERC20(_token).safeApprove(_pool, type(uint).max);
  }

  /// @notice Adds liquidity to a pool
  /// @param _amounts Amounts of the tokens respectively
  /// @param _minMintAmount Minimum liquidity expected to receive after adding liquidity
  function addLiquidity(uint256[3] memory _amounts, uint256 _minMintAmount) public payable {
    if (_amounts[0] > 0) {
      IERC20(tokens[0]).safeTransferFrom(msg.sender, address(this), _amounts[0]);
    }

    if (_amounts[1] > 0) {
      IERC20(tokens[1]).safeTransferFrom(msg.sender, address(this), _amounts[1]);
    }

    if (_amounts[2] > 0) {
      IERC20(tokens[2]).safeTransferFrom(msg.sender, address(this), _amounts[2]);
    }

    uint balanceBefore = IERC20(token).balanceOf(address(this));

    Pool(pool).add_liquidity(_amounts, _minMintAmount);

    uint balanceAfter = IERC20(token).balanceOf(address(this));

    IERC20(token).transfer(msg.sender, balanceAfter - balanceBefore);
  }

  /// @notice Removes liquidity from the pool
  /// @param liquidity Amount of liquidity to withdraw
  /// @param minAmounts Minimum amounts expected to receive after withdrawal
  function removeLiquidity(uint liquidity, uint[3] memory minAmounts) public payable {
    IERC20(token).transferFrom(msg.sender, address(this), liquidity);

    uint balance1Before = IERC20(tokens[0]).balanceOf(address(this));
    uint balance2Before = IERC20(tokens[1]).balanceOf(address(this));
    uint balance3Before = IERC20(tokens[2]).balanceOf(address(this));

    Pool(pool).remove_liquidity(liquidity, minAmounts);

    uint balance1After = IERC20(tokens[0]).balanceOf(address(this));
    uint balance2After = IERC20(tokens[1]).balanceOf(address(this));
    uint balance3After = IERC20(tokens[2]).balanceOf(address(this));

    if (balance1After > balance1Before) {
      IERC20(tokens[0]).transfer(msg.sender, balance1After - balance1Before);
    }

    if (balance2After > balance2Before) {
      IERC20(tokens[1]).transfer(msg.sender, balance2After - balance2Before);
    }

    console.log("%s %s", balance2After, balance2Before);

    if (balance3After > balance3Before) {
      IERC20(tokens[2]).safeTransferFrom(address(this), msg.sender, balance3After - balance3Before);
    }
  }

  /// @notice Removes liquidity and received only 1 token in return
  /// @param _amount Amount of LP token to burn
  /// @param _i Index of receiving token in the pool
  /// @param min_amount Minimum amount expected to receive from token[i]
  function removeLiquidityOneCoin(uint _amount, uint _i, uint min_amount) public payable {
    IERC20(token).safeTransferFrom(msg.sender, address(this), _amount);

    uint balanceBefore = IERC20(tokens[_i]).balanceOf(address(this));

    Pool(pool).remove_liquidity_one_coin(_amount, _i, min_amount);

    uint balanceAfter = IERC20(tokens[_i]).balanceOf(address(this));

    IERC20(tokens[_i]).transfer(msg.sender, balanceAfter - balanceBefore);
  }

  /// @notice Withdraws fees and transfers them to owner
  function withdrawAdmin() public onlyOwner {
    require(address(this).balance > 0);

    payable(owner()).transfer(address(this).balance);
  }
}
