/*
                                           +##*:                                          
                                         .######-                                         
                                        .########-                                        
                                        *#########.                                       
                                       :##########+                                       
                                       *###########.                                      
                                      :############=                                      
                   *###################################################.                  
                   :##################################################=                   
                    .################################################-                    
                     .*#############################################-                     
                       =##########################################*.                      
                        :########################################=                        
                          -####################################=                          
                            -################################+.                           
               =##########################################################*               
               .##########################################################-               
                .*#######################################################:                
                  =####################################################*.                 
                   .*#################################################-                   
                     -##############################################=                     
                       -##########################################=.                      
                         :+####################################*-                         
           *###################################################################:          
           =##################################################################*           
            :################################################################=            
              =############################################################*.             
               .*#########################################################-               
                 :*#####################################################-                 
                   .=################################################+:                   
                      -+##########################################*-.                     
     .+*****************###########################################################*:     
      +############################################################################*.     
       :##########################################################################=       
         -######################################################################+.        
           -##################################################################+.          
             -*#############################################################=             
               :=########################################################+:               
                  :=##################################################+-                  
                     .-+##########################################*=:                     
                         .:=*################################*+-.                         
                              .:-=+*##################*+=-:.                              
                                     .:=*#########+-.                                     
                                         .+####*:                                         
                                           .*#:    */
// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;
pragma abicoder v2;

/// @title UniswapV3 proxy contract
/// @author Matin Kaboli
/// @notice Mints and Increases liquidity and swaps tokens
/// @dev This contract uses Permit2
interface IUniswap {
    struct SwapExactInputSingleParams {
        uint24 fee;
        uint160 sqrtPriceLimitX96;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    /// @notice Swaps `amountIn` of one token for as much as possible of another token
    /// @param params The params necessary to swap excact input single
    /// fee Fee of the uniswap pool. For example, 0.01% = 100
    /// tokenIn The input token
    /// tokenOut The receiving token
    /// amountIn The exact amount of tokenIn
    /// amountOutMinimum The minimum amount of tokenOut
    /// @return amountOut The exact amount of tokenOut received from the swap.
    function swapExactInputSingle(IUniswap.SwapExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);

    struct SwapExactInputSingleEthParams {
        uint24 fee;
        uint160 sqrtPriceLimitX96;
        address tokenOut;
        uint256 amountOutMinimum;
    }

    /// @notice Swaps `amountIn` of one token for as much as possible of another token
    /// @param params The params necessary to swap excact input single using ETH
    /// @dev One of the tokens is ETH
    /// fee Fee of the uniswap pool. For example, 0.01% = 100
    /// tokenOut The receiving token
    /// amountOutMinimum The minimum amount expected to receive
    /// @param proxyFee The fee of the proxy contract
    /// @return amountOut The exact amount of tokenOut received from the swap.
    function swapExactInputSingleETH(IUniswap.SwapExactInputSingleEthParams calldata params, uint256 proxyFee)
        external
        payable
        returns (uint256 amountOut);

    struct SwapExactOutputSingleParams {
        uint24 fee;
        uint160 sqrtPriceLimitX96;
        address tokenIn;
        address tokenOut;
        uint256 amountOut;
        uint256 amountInMaximum;
    }

    /// @notice Swaps as little as possible of one token for `amountOut` of another token
    /// @param params The params necessary to swap excact output single
    /// fee Fee of the uniswap pool. For example, 0.01% = 100
    /// tokenOut The receiving token
    /// amountOut The exact amount expected to receive
    /// @return amountIn The exact amount of tokenIn spent to receive the exact desired amountOut.
    function swapExactOutputSingle(IUniswap.SwapExactOutputSingleParams calldata params)
        external
        payable
        returns (uint256 amountIn);

    struct SwapExactOutputSingleETHParams {
        uint24 fee;
        uint160 sqrtPriceLimitX96;
        address tokenOut;
        uint256 amountOut;
    }

    /// @notice Swaps as little as possible of one token for `amountOut` of another token
    /// @param params The params necessary to swap excact output single
    /// fee Fee of the uniswap pool. For example, 0.01% = 100
    /// tokenOut The receiving token
    /// @return amountIn The exact amount of tokenIn spent to receive the exact desired amountOut.
    function swapExactOutputSingleETH(IUniswap.SwapExactOutputSingleETHParams calldata params, uint256 proxyFee)
        external
        payable
        returns (uint256 amountIn);

    struct SwapExactInputMultihopParams {
        bytes path;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    /// @notice Swaps a fixed amount of token1 for a maximum possible amount of token2 through an intermediary pool.
    /// @param params The params necessary to swap exact input multihop
    /// path abi.encodePacked of [address, u24, address, u24, address]
    /// amountOutMinimum Minimum amount of token2
    /// @return amountOut The exact amount of tokenOut received from the swap.
    function swapExactInputMultihop(SwapExactInputMultihopParams calldata params)
        external
        payable
        returns (uint256 amountOut);

    struct SwapMultihopPath {
        bytes path;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    /// @notice Swaps a fixed amount of ETH for a maximum possible amount of token2 through an intermediary pool.
    /// @param params The params necessary to swap exact input multihop
    /// path abi.encodePacked of [WETH, u24, address, u24, address]
    /// amountOutMinimum Minimum amount of token2
    /// @param proxyFee Fee of the proxy contract
    /// @return amountOut The exact amount of tokenOut received from the swap.
    function swapExactInputMultihopETH(SwapMultihopPath calldata params, uint256 proxyFee)
        external
        payable
        returns (uint256 amountOut);

    struct SwapExactOutputMultihopParams {
        bytes path;
        uint256 amountInMaximum;
        uint256 amountOut;
    }

    /// @notice Swaps a minimum possible amount of token1 for a fixed amount of token2 through an intermediary pool.
    /// @param params The params necessary to swap exact output multihop
    /// path abi.encodePacked of [address, u24, address, u24, address]
    /// amountOut The desired amount of token2.
    /// @return amountIn The exact amount of tokenIn spent to receive the exact desired amountOut.
    function swapExactOutputMultihop(SwapExactOutputMultihopParams calldata params)
        external
        payable
        returns (uint256 amountIn);

    struct SwapExactOutputMultihopETHParams {
        bytes path;
        uint256 amountOut;
    }

    /// @notice Swaps a minimum possible amount of ETH for a fixed amount of token2 through an intermediary pool.
    /// @param params The params necessary to swap exact output multihop
    /// path abi.encodePacked of [address, u24, address, u24, WETH]
    /// amountOut The desired amount of token2.
    /// @param proxyFee Fee of the proxy contract
    /// @return amountIn The exact amount of tokenIn spent to receive the exact desired amountOut.
    function swapExactOutputMultihopETH(SwapExactOutputMultihopETHParams calldata params, uint256 proxyFee)
        external
        payable
        returns (uint256 amountIn);

    /// @notice Swaps a fixed amount of token for a maximum possible amount of token2 through intermediary pools.
    /// @param paths Paths of uniswap pools
    /// @return amountOut The exact amount of tokenOut received from the swap.
    function swapExactInputMultihopMultiPool(SwapMultihopPath[] calldata paths)
        external
        payable
        returns (uint256 amountOut);

    /// @notice Swaps a fixed amount of ETH for a maximum possible amount of token2 through intermediary pools.
    /// @param paths Paths of uniswap pools
    /// @param proxyFee Fee of the proxy contract
    /// @return amountOut The exact amount of tokenOut received from the swap.
    function swapExactInputMultihopMultiPoolETH(SwapMultihopPath[] calldata paths, uint256 proxyFee)
        external
        payable
        returns (uint256 amountOut);

    /// @notice Swaps a minimum possible amount of token for a fixed amount of token2 through intermediary pools.
    /// @param paths Paths of uniswap pools
    /// @return amountIn The exact amount of tokenIn spent to receive the exact desired amountOut.
    function swapExactOutputMultihopMultiPool(SwapMultihopPath[] calldata paths)
        external
        payable
        returns (uint256 amountIn);

    /// @notice Swaps a minimum possible amount of ETH for a fixed amount of token2 through intermediary pools.
    /// @param paths Paths of uniswap pools
    /// @param proxyFee Fee of the proxy contract
    /// @return amountIn The exact amount of ETH spent to receive the exact desired amountOut.
    function swapExactOutputMultihopMultiPoolETH(SwapMultihopPath[] calldata paths, uint256 proxyFee)
        external
        payable
        returns (uint256 amountIn);

    struct MintParams {
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        address token0;
        address token1;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 amount0Desired;
        uint256 amount1Desired;
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
    /// @param proxyFee Fee of the proxy contract
    /// @return tokenId The id of the newly minted ERC721
    /// @return liquidity The amount of liquidity for the position
    /// @return amount0 The amount of token0
    /// @return amount1 The amount of token1
    function mint(IUniswap.MintParams calldata params, uint256 proxyFee)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);

    struct IncreaseLiquidityParams {
        address token0;
        address token1;
        uint256 tokenId;
        uint256 amountAdd0;
        uint256 amountAdd1;
        uint256 amount0Min;
        uint256 amount1Min;
    }

    /// @notice Increases liquidity in the current range
    /// @param params The params necessary to increase liquidity in a uniswap position
    /// @dev Pool must be initialized already to add liquidity
    /// tokenId The id of the erc721 token
    /// amountAdd0 The amount to add of token0
    /// amountAdd1 The amount to add of token1
    /// amount0Min Minimum amount of the first token to receive
    /// amount1Min Minimum amount of the second token to receive
    /// @param proxyFee Fee of the proxy contract
    function increaseLiquidity(IncreaseLiquidityParams calldata params, uint256 proxyFee)
        external
        payable
        returns (uint128 liquidity, uint256 amount0, uint256 amount1);
}
