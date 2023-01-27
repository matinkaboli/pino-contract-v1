// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./Proxy.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface Pool {
    function add_liquidity(uint256[3] memory amounts, uint256 min_mint_amount) external payable;
    function remove_liquidity(uint256 _amount, uint256[3] memory min_amounts) external;
    function remove_liquidity_one_coin(uint256 _token_amount, uint256 _i, uint256 _min_amount)
        external
        returns (uint256);
    function remove_liquidity_one_coin(uint256 _token_amount, int128 _i, uint256 _min_amount)
        external
        returns (uint256);
}

/// @title Curve proxy contract
/// @author Matin Kaboli
/// @notice Add/Remove liquidity, and exchange tokens in a pool
/// @dev works for different pools, but use with caution (tested only for StableSwap)
contract Curve3Token is Proxy {
    using SafeERC20 for IERC20;

    constructor(address _pool, address[] memory _tokens, address _token, uint8 _ethIndex)
        Proxy(_pool, _tokens, _token, _ethIndex)
    {}

    /// @notice Adds liquidity to a pool
    /// @param _amounts Amounts of the tokens respectively
    /// @param _minMintAmount Minimum liquidity expected to receive after adding liquidity
    /// @param _fee Fee of the proxy
    function addLiquidity(uint256[3] memory _amounts, uint256 _minMintAmount, uint256 _fee) public payable {
        uint256 ethValue = 0;

        retrieveToken(0, _amounts[0]);
        retrieveToken(1, _amounts[1]);
        retrieveToken(2, _amounts[2]);

        if (ethIndex != 100) {
            ethValue = msg.value - _fee;
        }

        uint256 balanceBefore = IERC20(token).balanceOf(address(this));

        Pool(pool).add_liquidity{value: ethValue}(_amounts, _minMintAmount);

        uint256 balanceAfter = IERC20(token).balanceOf(address(this));

        IERC20(token).transfer(msg.sender, balanceAfter - balanceBefore);
    }

    /// @notice Removes liquidity from the pool
    /// @param liquidity Amount of liquidity to withdraw
    /// @param minAmounts Minimum amounts expected to receive after withdrawal
    function removeLiquidity(uint256 liquidity, uint256[3] memory minAmounts) public payable {
        IERC20(token).safeTransferFrom(msg.sender, address(this), liquidity);

        uint256 balance0Before = getBalance(0);
        uint256 balance1Before = getBalance(1);
        uint256 balance2Before = getBalance(2);

        Pool(pool).remove_liquidity(liquidity, minAmounts);

        uint256 balance0After = getBalance(0);
        uint256 balance1After = getBalance(1);
        uint256 balance2After = getBalance(2);

        send(0, balance0After - balance0Before);
        send(1, balance1After - balance1Before);
        send(2, balance2After - balance2Before);
    }

    /// @notice Removes liquidity and received only 1 token in return
    /// @dev Use this for those pools that use int128 for _i
    /// @param _amount Amount of LP token to burn
    /// @param _i Index of receiving token in the pool
    /// @param min_amount Minimum amount expected to receive from token[i]
    function removeLiquidityOneCoinI(uint256 _amount, int128 _i, uint256 min_amount) public payable {
        uint256 i = 0;
        if (_i == 1) {
            i = 1;
        } else if (_i == 2) {
            i = 2;
        }

        IERC20(token).safeTransferFrom(msg.sender, address(this), _amount);

        uint256 balanceBefore = getBalance(i);

        Pool(pool).remove_liquidity_one_coin(_amount, _i, min_amount);

        uint256 balanceAfter = getBalance(i);

        send(i, balanceAfter - balanceBefore);
    }

    /// @notice Removes liquidity and received only 1 token in return
    /// @dev Use this for those pools that use uint256 for _i
    /// @param _amount Amount of LP token to burn
    /// @param _i Index of receiving token in the pool
    /// @param min_amount Minimum amount expected to receive from token[i]
    function removeLiquidityOneCoinU(uint256 _amount, uint256 _i, uint256 min_amount) public payable {
        IERC20(token).safeTransferFrom(msg.sender, address(this), _amount);

        uint256 balanceBefore = getBalance(_i);

        Pool(pool).remove_liquidity_one_coin(_amount, _i, min_amount);

        uint256 balanceAfter = getBalance(_i);

        send(_i, balanceAfter - balanceBefore);
    }
}
