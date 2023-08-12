// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./IPool.sol";

/// @title Curve proxy contract interface
/// @author Pino Development Team
/// @notice Exchanges tokens from different pools and add/remove liquidity
interface ICurve {
    /// @notice Perform up to four swaps in a single transaction
    /// @dev Routing and swap params must be determined off-chain. This functionality is designed for gas efficiency over ease-of-use.
    /// @param _amount The amount that will be used for the swap
    /// @param _route Array of [initial token, pool, token, pool, token, ...]
    /// The array is iterated until a pool address of 0x00, then the last
    /// given token is transferred to `_receiver`
    /// @param _swap_params Multidimensional array of [i, j, swap type] where i and j are the correct
    /// values for the n'th pool in `_route`. The swap type should be
    /// 1 for a stableswap `exchange`,
    /// 2 for stableswap `exchange_underlying`,
    /// 3 for a cryptoswap `exchange`,
    /// 4 for a cryptoswap `exchange_underlying`,
    /// 5 for factory metapools with lending base pool `exchange_underlying`,
    /// 6 for factory crypto-meta pools underlying exchange (`exchange` method in zap),
    /// 7-9 for underlying coin -> LP token "exchange" (actually `add_liquidity`),
    /// 10-11 for LP token -> underlying coin "exchange" (actually `remove_liquidity_one_coin`)
    /// @param _expected The minimum amount received after the final swap.
    /// @param _pools Array of pools for swaps via zap contracts. This parameter is only needed for
    /// Polygon meta-factories underlying swaps.
    /// @param _recipient The address that will receive the swap
    /// @return received Received amount of the final output token
    function exchangeMultiple(
        uint256 _amount,
        uint256 _expected,
        address[9] memory _route,
        uint256[3][4] memory _swap_params,
        address[4] memory _pools,
        address _recipient
    ) external payable returns (uint256 received);

    /// @notice Perform up to four swaps in a single transaction
    /// @dev Routing and swap params must be determined off-chain. This functionality is designed for gas efficiency over ease-of-use.
    /// @param _amount The amount of `_route[0]` token being sent.
    /// @param _route Array of [initial token, pool, token, pool, token, ...]
    /// The array is iterated until a pool address of 0x00, then the last
    /// given token is transferred to `_receiver`
    /// @param _swap_params Multidimensional array of [i, j, swap type] where i and j are the correct
    /// values for the n'th pool in `_route`. The swap type should be
    /// 1 for a stableswap `exchange`,
    /// 2 for stableswap `exchange_underlying`,
    /// 3 for a cryptoswap `exchange`,
    /// 4 for a cryptoswap `exchange_underlying`,
    /// 5 for factory metapools with lending base pool `exchange_underlying`,
    /// 6 for factory crypto-meta pools underlying exchange (`exchange` method in zap),
    /// 7-9 for underlying coin -> LP token "exchange" (actually `add_liquidity`),
    /// 10-11 for LP token -> underlying coin "exchange" (actually `remove_liquidity_one_coin`)
    /// @param _expected The minimum amount received after the final swap.
    /// @param _pools Array of pools for swaps via zap contracts. This parameter is only needed for
    /// Polygon meta-factories underlying swaps.
    /// @param _proxyFee Fee of the proxy contract
    /// @return received Received amount of the final output token
    function exchangeMultipleETH(
        uint256 _amount,
        uint256 _expected,
        address[9] memory _route,
        uint256[3][4] memory _swap_params,
        address[4] memory _pools,
        address _recipient,
        uint96 _proxyFee
    ) external payable returns (uint256 received);

    /// @notice Adds liquidity to a pool
    /// @param _amounts Amounts of the tokens in the pool to deposit
    /// @param _minMintAmount Minimum amount of LP tokens to mint from the deposit
    /// @param _pool Address of the pool
    /// @param _proxyFee Fee of the proxy contract
    function addLiquidity(uint256[2] memory _amounts, uint256 _minMintAmount, CurvePool _pool, uint96 _proxyFee)
        external
        payable;

    /// @notice Withdraw token from the pool
    /// @param _amount Quantity of LP tokens to burn in the withdrawal
    /// @param _minAmounts Minimum amounts of underlying tokens to receive
    /// @param _pool Address of the pool
    function removeLiquidity(uint256 _amount, uint256[2] memory _minAmounts, CurvePool _pool) external payable;

    /// @notice Withdraw a single token from the pool
    /// @param _amount Amount of LP tokens to burn in the withdrawal
    /// @param _i Index value of the coin to withdraw
    /// @param _minAmount Minimum amount of coin to receive
    /// @param _pool Address of the pool
    function removeLiquidityOneCoinI(uint256 _amount, int128 _i, uint256 _minAmount, CurvePool _pool)
        external
        payable;

    /// @notice Withdraw a single token from the pool
    /// @param _amount Amount of LP tokens to burn in the withdrawal
    /// @param _i Index value of the coin to withdraw
    /// @param _minAmount Minimum amount of coin to receive
    /// @param _pool Address of the pool
    function removeLiquidityOneCoinU(uint256 _amount, uint256 _i, uint256 _minAmount, CurvePool _pool)
        external
        payable;
}
