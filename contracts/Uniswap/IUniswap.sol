// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
pragma abicoder v2;

import "../interfaces/Permit2.sol";

interface IUniswap {
    struct SwapExactInputSingleParams {
        uint24 fee;
        address tokenOut;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
        bool receiveETH;
        ISignatureTransfer.PermitTransferFrom permit;
        bytes signature;
    }

    /// @notice Swaps `amountIn` of one token for as much as possible of another token
    /// @param params The params necessary to swap excact input single
    /// fee Fee of the uniswap pool. For example, 0.01% = 100
    /// tokenOut The receiving token
    /// amountOutMinimum The minimum amount expected to receive
    /// receiveETH Receive ETH or WETH
    /// permit Permit2 PermitTransferFrom struct, includes receiver, token and amount
    /// signature Signature, used by Permit2
    function swapExactInputSingle(SwapExactInputSingleParams calldata params) external payable returns (uint256);

    struct SwapExactInputSingleEthParams {
        uint24 fee;
        address tokenOut;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
        uint256 proxyFee;
    }

    /// @notice Swaps `amountIn` of one token for as much as possible of another token
    /// @param params The params necessary to swap excact input single using ETH
    /// @dev One of the tokens is ETH
    /// fee Fee of the uniswap pool. For example, 0.01% = 100
    /// tokenOut The receiving token
    /// amountOutMinimum The minimum amount expected to receive
    /// proxyFee The fee of the proxy contract
    function swapExactInputSingleETH(SwapExactInputSingleEthParams calldata params)
        external
        payable
        returns (uint256);

    struct SwapExactOutputSingleParams {
        uint24 fee;
        address tokenOut;
        uint256 amountOut;
        uint160 sqrtPriceLimitX96;
        ISignatureTransfer.PermitTransferFrom permit;
        bytes signature;
    }

    /// @notice Swaps as little as possible of one token for `amountOut` of another token
    /// @param params The params necessary to swap excact output single
    /// fee Fee of the uniswap pool. For example, 0.01% = 100
    /// tokenOut The receiving token
    /// amountOut The exact amount expected to receive
    /// permit Permit2 PermitTransferFrom struct, includes receiver, token and amount
    /// signature Signature, used by Permit2
    /// @return amountIn The amount of the input token
    function swapExactOutputSingle(SwapExactOutputSingleParams calldata params) external payable returns (uint256);

    struct SwapExactInputMultihopParams {
        bytes path;
        uint256 amountOutMinimum;
        ISignatureTransfer.PermitTransferFrom permit;
        bytes signature;
    }

    /// @notice Swaps a fixed amount of token1 for a maximum possible amount of token2 through an intermediary pool.
    /// @param params The params necessary to swap exact input multihop
    /// path abi.encodePacked of [address, u24, address, u24, address]
    /// amountOutMinimum Minimum amount of token2
    /// permit Permit2 PermitTransferFrom struct, includes receiver, token and amount
    /// signature Signature, used by Permit2
    /// @return amountOut The amount of token2 received after the swap.
    function swapExactInputMultihop(SwapExactInputMultihopParams calldata params)
        external
        payable
        returns (uint256 amountOut);

    struct SwapExactInputMultihopETHParams {
        bytes path;
        uint256 amountOutMinimum;
        uint256 proxyFee;
    }

    /// @notice Swaps a fixed amount of ETH for a maximum possible amount of token2 through an intermediary pool.
    /// @param params The params necessary to swap exact input multihop
    /// path abi.encodePacked of [WETH, u24, address, u24, address]
    /// amountOutMinimum Minimum amount of token2
    /// @return amountOut The amount of token2 received after the swap.
    function swapExactInputMultihopETH(SwapExactInputMultihopETHParams calldata params)
        external
        payable
        returns (uint256 amountOut);

    struct SwapExactOutputMultihopParams {
        bytes path;
        uint256 amountOut;
        ISignatureTransfer.PermitTransferFrom permit;
        bytes signature;
    }

    /// @notice Swaps a minimum possible amount of token1 for a fixed amount of token2 through an intermediary pool.
    /// @param params The params necessary to swap exact output multihop
    /// path abi.encodePacked of [address, u24, address, u24, address]
    /// amountOut The desired amount of token2.
    /// permit Permit2 PermitTransferFrom struct, includes receiver, token and amount
    /// signature Signature, used by Permit2
    /// @return amountIn The amountIn of token1 actually spent to receive the desired amountOut.
    function swapExactOutputMultihop(SwapExactOutputMultihopParams calldata params)
        external
        payable
        returns (uint256 amountIn);

    struct SwapExactOutputMultihopETHParams {
        bytes path;
        uint256 amountOut;
        uint256 proxyFee;
    }

    /// @notice Swaps a minimum possible amount of ETH for a fixed amount of token2 through an intermediary pool.
    /// @param params The params necessary to swap exact output multihop
    /// path abi.encodePacked of [address, u24, address, u24, WETH]
    /// amountOut The desired amount of token2.
    /// proxyFee Fee of the proxy contract
    /// @return amountIn The amountIn of token1 actually spent to receive the desired amountOut.
    function swapExactOutputMultihopETH(SwapExactOutputMultihopETHParams calldata params)
        external
        payable
        returns (uint256 amountIn);

    struct MintParams {
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 proxyFee;
        uint256 amount0Min;
        uint256 amount1Min;
        address token0;
        address token1;
        ISignatureTransfer.PermitBatchTransferFrom permit;
        bytes signature;
    }

    /// @notice Creates a new position wrapped in a NFT
    /// @param params The params necessary to mint a new position
    /// fee Fee of the uniswap pool. For example, 0.01% = 100
    /// tickLower The lower tick in the range
    /// tickUpper The upper tick in the range
    /// amount0Min Minimum amount of the first token to receive
    /// amount1Min Minimum amount of the second token to receive
    /// token0 Token0 address
    /// token1 Token1 address
    /// permit Permit2 PermitTransferFrom struct, includes receiver, token and amount
    /// signature Signature, used by Permit2
    /// @return tokenId The id of the newly minted ERC721
    /// @return liquidity The amount of liquidity for the position
    /// @return amount0 The amount of token0
    /// @return amount1 The amount of token1
    function mint(MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);

    struct CollectParams {
        uint256 tokenId;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    // /// @notice Collects the fees associated with provided liquidity
    // /// @param params The params necessary to collect fees
    // /// tokenId The id of the erc721 token
    // /// amount0Max Maximum amount of token0 to collect
    // /// amount1Max Maximum amount of token1 to collect
    // /// @return amount0 The amount of fees collected in token0
    // /// @return amount1 The amount of fees collected in token1
    // function collect(CollectParams calldata params) external payable returns (uint256 amount0, uint256 amount1);

    struct IncreaseLiquidityParams {
        uint256 tokenId;
        uint256 proxyFee;
        uint256 amountAdd0;
        uint256 amountAdd1;
        uint256 amount0Min;
        uint256 amount1Min;
        ISignatureTransfer.PermitBatchTransferFrom permit;
        bytes signature;
    }

    /// @notice Increases liquidity in the current range
    /// @param params The params necessary to increase liquidity in a uniswap position
    /// @dev Pool must be initialized already to add liquidity
    /// tokenId The id of the erc721 token
    /// amountAdd0 The amount to add of token0
    /// amountAdd1 The amount to add of token1
    /// amount0Min Minimum amount of the first token to receive
    /// amount1Min Minimum amount of the second token to receive
    /// permit Permit2 PermitTransferFrom struct, includes receiver, token and amount
    /// signature Signature, used by Permit2
    function increaseLiquidity(IncreaseLiquidityParams calldata params)
        external
        payable
        returns (uint128 liquidity, uint256 amount0, uint256 amount1);

    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
    }

    // /// @notice Decreases the current liquidity.
    // /// @param params The params necessary to decrease liquidity in a uniswap position
    // /// tokenId The id of the erc721 token
    // /// liquidity The liquidity amount to decrease.
    // /// amount0Min Minimum amount of the first token to receive
    // /// amount1Min Minimum amount of the second token to receive
    // /// @return amount0 The amount received back in token0
    // /// @return amount1 The amount returned back in token1
    // function decreaseLiquidity(DecreaseLiquidityParams calldata params)
    //     external
    //     payable
    //     returns (uint256 amount0, uint256 amount1);
}
