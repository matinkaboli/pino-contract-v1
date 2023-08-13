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

/// @title UniswapV3 proxy contract
/// @author Pino Development Team
/// @notice Mints and Increases liquidity and swaps tokens
/// @dev This contract uses Permit2
contract Uniswap is IUniswap, Pino {
    using SafeERC20 for IERC20;

    event Mint(uint256 tokenId);

    address public immutable swapRouter2;
    INonfungiblePositionManager public immutable nfpm;

    constructor(Permit2 _permit2, IWETH9 _weth, address _swapRouter2, INonfungiblePositionManager _nfpm)
        Pino(_permit2, _weth)
    {
        nfpm = _nfpm;
        swapRouter2 = _swapRouter2;

        IERC20(address(_weth)).safeApprove(address(_nfpm), type(uint256).max);
        IERC20(address(_weth)).safeApprove(_swapRouter2, type(uint256).max);
    }

    /// @notice Calls Uniswap Router 2 and swpas using calldata
    /// @param _data Calldata generated from the uniswap smart order router
    function swap(bytes calldata _data) external payable {
      (bool success,) = swapRouter2.call(_data);

      _require(success, ErrorCodes.FAIELD_TO_SWAP_USING_UNISWAP);
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
