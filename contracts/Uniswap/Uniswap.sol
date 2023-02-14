// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
pragma abicoder v2;

import "../Proxy.sol";
import "../interfaces/IUniversalRouter.sol";
import "../interfaces/INonfungiblePositionManager.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract Uniswap is Proxy {
    using SafeERC20 for IERC20;
    address WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    ISwapRouter public immutable swapRouter;
    INonfungiblePositionManager public immutable nonfungiblePositionManager;
    mapping(address => mapping(address => bool)) public alreadyApprovedTokens;

    constructor(ISwapRouter _swapRouter, Permit2 _permit2, INonfungiblePositionManager _nfpm, IERC20[] memory _tokens)
        Proxy(_permit2)
    {
        swapRouter = _swapRouter;
        nonfungiblePositionManager = _nfpm;

        for (uint8 i = 0; i < _tokens.length; ++i) {
            _tokens[i].safeApprove(address(_nfpm), type(uint256).max);
            _tokens[i].safeApprove(address(_swapRouter), type(uint256).max);

            alreadyApprovedTokens[address(_tokens[i])][address(_nfpm)] = true;
            alreadyApprovedTokens[address(_tokens[i])][address(_swapRouter)] = true;
        }
    }

    function approveToken(IERC20 _token) public onlyOwner {
        _token.safeApprove(address(swapRouter), type(uint256).max);
        _token.safeApprove(address(nonfungiblePositionManager), type(uint256).max);

        alreadyApprovedTokens[address(_token)][address(swapRouter)] = true;
        alreadyApprovedTokens[address(_token)][address(nonfungiblePositionManager)] = true;
    }

    function swapExactInputSingle(
        uint24 _fee,
        address _tokenOut,
        uint256 _amountOutMinimum,
        uint160 _sqrtPriceLimitX96,
        ISignatureTransfer.PermitTransferFrom calldata _permit,
        bytes calldata _signature
    ) public payable returns (uint256) {
        permit2.permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );

        return swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: _permit.permitted.token,
                tokenOut: _tokenOut,
                fee: _fee,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: _permit.permitted.amount,
                amountOutMinimum: _amountOutMinimum,
                sqrtPriceLimitX96: _sqrtPriceLimitX96
            })
        );
    }

    function swapExactOutputSingle(
        uint24 _fee,
        address _tokenOut,
        uint256 _amountOut,
        uint160 _sqrtPriceLimitX96,
        ISignatureTransfer.PermitTransferFrom calldata _permit,
        bytes calldata _signature
    ) public payable returns (uint256) {
        permit2.permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );

        uint256 amountIn = swapRouter.exactOutputSingle(
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: _permit.permitted.token,
                tokenOut: _tokenOut,
                fee: _fee,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountOut: _amountOut,
                amountInMaximum: _permit.permitted.amount,
                sqrtPriceLimitX96: _sqrtPriceLimitX96
            })
        );

        if (amountIn < _permit.permitted.amount) {
            IERC20(_permit.permitted.token).safeTransfer(msg.sender, _permit.permitted.amount - amountIn);
        }

        return amountIn;
    }

    function mintNewPosition(
        uint24 _fee,
        int24 _tickLower,
        int24 _tickUpper,
        uint256 _amount0Min,
        uint256 _amount1Min,
        ISignatureTransfer.PermitBatchTransferFrom calldata _permit,
        bytes calldata _signature
    ) external payable returns (uint256 _tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) {
        // ISignatureTransfer.SignatureTransferDetails[] memory details = new ISignatureTransfer.SignatureTransferDetails[](2);
        //
        // details[0].to = address(this);
        // details[1].to = address(this);
        // details[0].requestedAmount = _permit.permitted[0].amount;
        // details[1].requestedAmount = _permit.permitted[1].amount;
        uint tokensLen = _permit.permitted.length;

        ISignatureTransfer.SignatureTransferDetails[] memory details =
            new ISignatureTransfer.SignatureTransferDetails[](tokensLen);


        details[0].to = address(this);
        details[0].requestedAmount = _permit.permitted[0].amount;

        if (tokensLen > 1) {
            details[1].to = address(this);
            details[1].requestedAmount = _permit.permitted[1].amount;
        }

        permit2.permitTransferFrom(_permit, details, msg.sender, _signature);

        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
            token0: _permit.permitted[0].token,
            token1: tokensLen > 1 ? _permit.permitted[1].token : WETH,
            fee: _fee,
            tickLower: _tickLower,
            tickUpper: _tickUpper,
            amount0Desired: _permit.permitted[0].amount,
            amount1Desired: tokensLen > 1 ? _permit.permitted[1].amount : msg.value,
            amount0Min: _amount0Min,
            amount1Min: _amount1Min,
            recipient: msg.sender,
            deadline: block.timestamp
        });

        (_tokenId, liquidity, amount0, amount1) = nonfungiblePositionManager.mint{value: msg.value}(params);

        if (amount0 < _permit.permitted[0].amount) {
            uint256 refund0 = _permit.permitted[0].amount - amount0;

            IERC20(_permit.permitted[0].token).safeTransfer(msg.sender, refund0);
        }

        // if (amount1 < _permit.permitted[1].amount) {
        //     uint256 refund1 = _permit.permitted[1].amount - amount1;
        //
        //     IERC20(_permit.permitted[1].token).safeTransfer(msg.sender, refund1);
        // }
    }

    /// @notice Collects the fees associated with provided liquidity
    /// @dev The contract must hold the erc721 token before it can collect fees
    /// @param _tokenId The id of the erc721 token
    /// @return amount0 The amount of fees collected in token0
    /// @return amount1 The amount of fees collected in token1
    function collectAllFees(uint256 _tokenId, uint128 _amount0Max, uint128 _amount1Max)
        external
        returns (uint256 amount0, uint256 amount1)
    {
        // Caller must own the ERC721 position
        // Call to safeTransfer will trigger `onERC721Received` which must return the selector else transfer will fail
        // nonfungiblePositionManager.safeTransferFrom(msg.sender, address(this), _tokenId);

        // set amount0Max and amount1Max to uint256.max to collect all fees
        // alternatively can set recipient to msg.sender and avoid another transaction in `sendToOwner`
        INonfungiblePositionManager.CollectParams memory params = INonfungiblePositionManager.CollectParams({
            tokenId: _tokenId,
            recipient: msg.sender,
            amount0Max: _amount0Max,
            amount1Max: _amount1Max
        });

        (amount0, amount1) = nonfungiblePositionManager.collect(params);
    }

    /// @notice Increases liquidity in the current range
    /// @dev Pool must be initialized already to add liquidity
    /// @param _tokenId The id of the erc721 token
    /// @param amount0 The amount to add of token0
    /// @param amount1 The amount to add of token1
    function increaseLiquidityCurrentRange(
        uint256 _tokenId,
        uint256 _amountAdd0,
        uint256 _amountAdd1,
        uint256 _amount0Min,
        uint256 _amount1Min
    ) external returns (uint128 liquidity, uint256 amount0, uint256 amount1) {
        INonfungiblePositionManager.IncreaseLiquidityParams memory params = INonfungiblePositionManager
            .IncreaseLiquidityParams({
            tokenId: _tokenId,
            amount0Desired: _amountAdd0,
            amount1Desired: _amountAdd1,
            amount0Min: _amount0Min,
            amount1Min: _amount1Min,
            deadline: block.timestamp
        });

        (liquidity, amount0, amount1) = nonfungiblePositionManager.increaseLiquidity(params);
    }

    /// @notice A function that decreases the current liquidity by half. An example to show how to call the `decreaseLiquidity` function defined in periphery.
    /// @param _tokenId The id of the erc721 token
    /// @return amount0 The amount received back in token0
    /// @return amount1 The amount returned back in token1
    function decreaseLiquidityInHalf(uint256 _tokenId, uint128 _liquidity, uint256 _amount0Min, uint256 _amount1Min)
        external
        returns (uint256 amount0, uint256 amount1)
    {
        // amount0Min and amount1Min are price slippage checks
        // if the amount received after burning is not greater than these minimums, transaction will fail
        INonfungiblePositionManager.DecreaseLiquidityParams memory params = INonfungiblePositionManager
            .DecreaseLiquidityParams({
            tokenId: _tokenId,
            liquidity: _liquidity,
            amount0Min: _amount0Min,
            amount1Min: _amount1Min,
            deadline: block.timestamp
        });

        (amount0, amount1) = nonfungiblePositionManager.decreaseLiquidity(params);
    }
}
