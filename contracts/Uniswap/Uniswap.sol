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

import "../Pino.sol";
import "../interfaces/IWETH9.sol";
import "../interfaces/Uniswap/IUniswap.sol";
import "../interfaces/Uniswap/INonfungiblePositionManager.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

/// @title UniswapV3 proxy contract
/// @author Matin Kaboli
/// @notice Mints and Increases liquidity and swaps tokens
/// @dev This contract uses Permit2
contract Uniswap is IUniswap, Pino {
    using SafeERC20 for IERC20;

    event Mint(uint256 tokenId);

    ISwapRouter public immutable swapRouter;
    INonfungiblePositionManager public immutable nfpm;

    constructor(Permit2 _permit2, IWETH9 _weth, ISwapRouter _swapRouter, INonfungiblePositionManager _nfpm)
        Pino(_permit2, _weth)
    {
        nfpm = _nfpm;
        swapRouter = _swapRouter;

        IERC20(address(_weth)).safeApprove(address(_nfpm), type(uint256).max);
        IERC20(address(_weth)).safeApprove(address(_swapRouter), type(uint256).max);
    }

    /// @notice Swaps a fixed amount of token1 for a maximum possible amount of token2 through an intermediary pool.
    /// @param _params The params necessary to swap exact input multihop
    /// path abi.encodePacked of [address, u24, address, u24, address]
    /// amountIn The exact amount in of token in
    /// amountOutMinimum Minimum amount of token out
    /// @return amountOut The exact amount of tokenOut received from the swap.
    function swapExactInputMultihop(SwapExactInputMultihopParams calldata _params)
        external
        payable
        returns (uint256 amountOut)
    {
        ISwapRouter.ExactInputParams memory swapParams = ISwapRouter.ExactInputParams({
            path: _params.path,
            deadline: block.timestamp,
            amountIn: _params.amountIn,
            amountOutMinimum: _params.amountOutMinimum,
            recipient: address(this)
        });

        amountOut = swapRouter.exactInput(swapParams);
    }

    /// @notice Swaps a minimum possible amount of token1 for a fixed amount of token2 through an intermediary pool.
    /// @param _params The params necessary to swap exact output multihop
    /// path abi.encodePacked of [address, u24, address, u24, address]
    /// amountInMaximum The maximum amount of token in
    /// amountOut The desired amount of token out
    /// @return amountIn The exact amount of tokenIn spent to receive the exact desired amountOut.
    function swapExactOutputMultihop(SwapExactOutputMultihopParams calldata _params)
        external
        payable
        returns (uint256 amountIn)
    {
        ISwapRouter.ExactOutputParams memory swapParams = ISwapRouter.ExactOutputParams({
            path: _params.path,
            recipient: address(this),
            deadline: block.timestamp,
            amountOut: _params.amountOut,
            amountInMaximum: _params.amountInMaximum
        });

        amountIn = swapRouter.exactOutput(swapParams);
    }

    /// @notice Swaps a fixed amount of token for a maximum possible amount of token2 through intermediary pools.
    /// @param _paths Paths of uniswap pools
    /// path abi.encodePacked of [address, u24, address, u24, address]
    /// amountIn The exact amount in of token in
    /// amountOutMinimum Minimum amount of token out
    /// @return amountOut The exact amount of tokenOut received from the swap.
    function swapExactInputMultihopMultiPool(SwapMultihopPath[] calldata _paths)
        external
        payable
        returns (uint256 amountOut)
    {
        amountOut = 0;

        for (uint8 i = 0; i < _paths.length;) {
            ISwapRouter.ExactInputParams memory swapParams = ISwapRouter.ExactInputParams({
                path: _paths[i].path,
                deadline: block.timestamp,
                amountIn: _paths[i].amountIn,
                recipient: address(this),
                amountOutMinimum: _paths[i].amountOutMinimum
            });

            uint256 exactAmountOut = swapRouter.exactInput(swapParams);

            amountOut += exactAmountOut;

            unchecked {
                ++i;
            }
        }
    }

    /// @notice Swaps a minimum possible amount of token for a fixed amount of token2 through intermediary pools.
    /// @param _paths Paths of uniswap pools
    /// path abi.encodePacked of [address, u24, address, u24, address]
    /// amountInMaximum The maximum amount of token in
    /// amountOut The desired amount of token out
    /// @return amountIn The exact amount of tokenIn spent to receive the exact desired amountOut.
    function swapExactOutputMultihopMultiPool(SwapMultihopPath[] calldata _paths)
        external
        payable
        returns (uint256 amountIn)
    {
        amountIn = 0;

        for (uint8 i = 0; i < _paths.length;) {
            ISwapRouter.ExactOutputParams memory swapParams = ISwapRouter.ExactOutputParams({
                path: _paths[i].path,
                deadline: block.timestamp,
                amountInMaximum: _paths[i].amountIn,
                amountOut: _paths[i].amountOutMinimum,
                recipient: address(this)
            });

            uint256 exactAmountIn = swapRouter.exactOutput(swapParams);
            amountIn += exactAmountIn;

            unchecked {
                ++i;
            }
        }
    }

    /// @notice Creates a new position wrapped in a NFT
    /// @param _params The params necessary to mint a new position
    /// fee Fee of the uniswap pool. For example, 0.01% = 100
    /// tickLower The lower tick in the range
    /// tickUpper The upper tick in the range
    /// token0 Token0 address
    /// token1 Token1 address
    /// amount0Min Minimum amount of the first token to receive
    /// amount1Min Minimum amount of the second token to receive
    /// amount0Desired Maximum amount of token0 that will be used in mint
    /// amount1Desired Maximum amount of token1 that will be used in mint
    /// @return tokenId The id of the newly minted ERC721
    /// @return liquidity The amount of liquidity for the position
    /// @return amount0 The amount of token0
    /// @return amount1 The amount of token1
    function mint(IUniswap.MintParams calldata _params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        INonfungiblePositionManager.MintParams memory mintParams = INonfungiblePositionManager.MintParams({
            fee: _params.fee,
            token0: _params.token0,
            token1: _params.token1,
            tickLower: _params.tickLower,
            tickUpper: _params.tickUpper,
            amount0Desired: _params.amount0Desired,
            amount1Desired: _params.amount1Desired,
            amount0Min: _params.amount0Min,
            amount1Min: _params.amount1Min,
            recipient: msg.sender,
            deadline: block.timestamp
        });

        (tokenId, liquidity, amount0, amount1) = nfpm.mint(mintParams);

        nfpm.sweepToken(_params.token0, 0, msg.sender);
        nfpm.sweepToken(_params.token1, 0, msg.sender);

        emit Mint(tokenId);
    }

    /// @notice Increases liquidity in the current range
    /// @param _params The params necessary to increase liquidity in a uniswap position
    /// @dev Pool must be initialized already to add liquidity
    /// tokenId The id of the erc721 token
    /// amountAdd0 The amount to add of token0
    /// amountAdd1 The amount to add of token1
    /// amount0Min Minimum amount of the first token to receive
    /// amount1Min Minimum amount of the second token to receive
    function increaseLiquidity(IUniswap.IncreaseLiquidityParams calldata _params)
        external
        payable
        returns (uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        INonfungiblePositionManager.IncreaseLiquidityParams memory increaseParams = INonfungiblePositionManager
            .IncreaseLiquidityParams({
            tokenId: _params.tokenId,
            amount0Desired: _params.amountAdd0,
            amount1Desired: _params.amountAdd1,
            amount0Min: _params.amount0Min,
            amount1Min: _params.amount1Min,
            deadline: block.timestamp
        });

        (liquidity, amount0, amount1) = nfpm.increaseLiquidity(increaseParams);

        nfpm.sweepToken(_params.token0, 0, msg.sender);
        nfpm.sweepToken(_params.token1, 0, msg.sender);
    }
}
