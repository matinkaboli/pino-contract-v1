// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
pragma abicoder v2;

import "hardhat/console.sol";
import "../Proxy.sol";
import "./IUniswap.sol";
import "../interfaces/IWETH9.sol";
import "../interfaces/IUniversalRouter.sol";
import "../interfaces/INonfungiblePositionManager.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract Uniswap is IERC721Receiver, IUniswap, Proxy {
    using SafeERC20 for IERC20;

    event Mint(uint256 tokenId);

    /// @notice Represents the deposit of an NFT
    struct Deposit {
        address owner;
        uint128 liquidity;
        address token0;
        address token1;
    }

    address payable public immutable weth;
    ISwapRouter public immutable swapRouter;
    mapping(uint256 => Deposit) public deposits;
    IUniversalRouter public immutable universalRouter;
    INonfungiblePositionManager public immutable nfpm;
    mapping(address => mapping(address => bool)) public alreadyApprovedTokens;

    constructor(
        ISwapRouter _swapRouter,
        Permit2 _permit2,
        INonfungiblePositionManager _nfpm,
        address payable _weth,
        IUniversalRouter _universalRouter,
        IERC20[] memory _tokens
    ) Proxy(_permit2) {
        weth = _weth;
        nfpm = _nfpm;
        swapRouter = _swapRouter;
        universalRouter = _universalRouter;

        for (uint8 i = 0; i < _tokens.length; ++i) {
            _tokens[i].safeApprove(address(_nfpm), type(uint256).max);
            _tokens[i].safeApprove(address(_swapRouter), type(uint256).max);

            alreadyApprovedTokens[address(_tokens[i])][address(_nfpm)] = true;
            alreadyApprovedTokens[address(_tokens[i])][address(_swapRouter)] = true;
        }
    }

    // @notice Implementing `onERC721Received` so this contract can receive custody of erc721 tokens
    function onERC721Received(address operator, address, uint256 tokenId, bytes calldata) external override returns (bytes4) {
        _createDeposit(operator, tokenId);

        return this.onERC721Received.selector;
    }

    function _createDeposit(address owner, uint256 tokenId) internal {
        (,, address token0, address token1,,,, uint128 liquidity,,,,) = nfpm.positions(tokenId);

        deposits[tokenId] = Deposit({owner: owner, liquidity: liquidity, token0: token0, token1: token1});
    }

    function approveToken(IERC20 _token) public onlyOwner {
        _token.safeApprove(address(nfpm), type(uint256).max);
        _token.safeApprove(address(swapRouter), type(uint256).max);

        alreadyApprovedTokens[address(_token)][address(nfpm)] = true;
        alreadyApprovedTokens[address(_token)][address(swapRouter)] = true;
    }

    /// @inheritdoc IUniswap
    function swapExactInputSingle(IUniswap.SwapExactInputSingleParams calldata params)
        external
        payable
        returns (uint256)
    {
        if (params.receiveETH) {
            require(params.tokenOut == weth, "Token out must be WETH");
        }

        permit2.permitTransferFrom(
            params.permit,
            ISignatureTransfer.SignatureTransferDetails({
                to: address(this),
                requestedAmount: params.permit.permitted.amount
            }),
            msg.sender,
            params.signature
        );

        uint256 amountOut = swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                fee: params.fee,
                tokenIn: params.permit.permitted.token,
                tokenOut: params.tokenOut,
                deadline: block.timestamp,
                amountIn: params.permit.permitted.amount,
                amountOutMinimum: params.amountOutMinimum,
                sqrtPriceLimitX96: params.sqrtPriceLimitX96,
                recipient: params.receiveETH ? address(this) : msg.sender
            })
        );

        if (params.receiveETH) {
            IWETH9(payable(weth)).withdraw(amountOut);
            (bool sent,) = payable(msg.sender).call{value: amountOut}("");
            require(sent, "Failed to send Ether");
        }

        return amountOut;
    }

    /// @inheritdoc IUniswap
    function swapExactInputSingleETH(IUniswap.SwapExactInputSingleEthParams calldata params)
        external
        payable
        returns (uint256)
    {
        uint256 value = msg.value - params.proxyFee;

        return swapRouter.exactInputSingle{value: value}(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(weth),
                tokenOut: params.tokenOut,
                fee: params.fee,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: value,
                amountOutMinimum: params.amountOutMinimum,
                sqrtPriceLimitX96: params.sqrtPriceLimitX96
            })
        );
    }

    /// @inheritdoc IUniswap
    function swapExactOutputSingle(IUniswap.SwapExactOutputSingleParams calldata params)
        external
        payable
        returns (uint256)
    {
        permit2.permitTransferFrom(
            params.permit,
            ISignatureTransfer.SignatureTransferDetails({
                to: address(this),
                requestedAmount: params.permit.permitted.amount
            }),
            msg.sender,
            params.signature
        );

        uint256 amountIn = swapRouter.exactOutputSingle(
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: params.permit.permitted.token,
                tokenOut: params.tokenOut,
                fee: params.fee,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountOut: params.amountOut,
                amountInMaximum: params.permit.permitted.amount,
                sqrtPriceLimitX96: params.sqrtPriceLimitX96
            })
        );

        if (amountIn < params.permit.permitted.amount) {
            IERC20(params.permit.permitted.token).safeTransfer(msg.sender, params.permit.permitted.amount - amountIn);
        }

        return amountIn;
    }

    /// @inheritdoc IUniswap
    function mint(IUniswap.MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        uint256 tokensLen = params.permit.permitted.length;

        require(params.permit.permitted[0].token == params.token0);

        ISignatureTransfer.SignatureTransferDetails[] memory details =
            new ISignatureTransfer.SignatureTransferDetails[](tokensLen);

        details[0].to = address(this);
        details[0].requestedAmount = params.permit.permitted[0].amount;

        // Assume that permit.permitted.length == 1
        address token1 = weth;
        uint256 amount1Desired = msg.value - params.proxyFee;

        if (tokensLen > 1) {
            details[1].to = address(this);
            details[1].requestedAmount = params.permit.permitted[1].amount;

            token1 = params.permit.permitted[1].token;
            amount1Desired = params.permit.permitted[1].amount;
        } else {
            if (params.token0 == weth || params.token1 == weth) {
                IWETH9(weth).deposit{value: amount1Desired}();
            }
        }

        require(token1 == params.token1);

        permit2.permitTransferFrom(params.permit, details, msg.sender, params.signature);

        INonfungiblePositionManager.MintParams memory mintParams = INonfungiblePositionManager.MintParams({
            fee: params.fee,
            token0: params.token0,
            token1: params.token1,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            amount0Desired: params.permit.permitted[0].amount,
            amount1Desired: amount1Desired,
            amount0Min: params.amount0Min,
            amount1Min: params.amount1Min,
            recipient: msg.sender,
            deadline: block.timestamp
        });

        (tokenId, liquidity, amount0, amount1) = nfpm.mint(mintParams);

        if (amount0 < params.permit.permitted[0].amount) {
            uint256 refund0 = params.permit.permitted[0].amount - amount0;

            IERC20(params.permit.permitted[0].token).safeTransfer(msg.sender, refund0);
        }

        if (amount1 < amount1Desired) {
            uint256 refund1 = amount1Desired - amount1;

            if (tokensLen > 1) {
                IERC20(token1).safeTransfer(msg.sender, refund1);
            } else {
                IWETH9(weth).withdraw(refund1);
                (bool success,) = payable(msg.sender).call{value: refund1}("");

                require(success, "Failed to send back eth");
            }
        }

        _createDeposit(msg.sender, tokenId);
        emit Mint(tokenId);
    }

    // /// @inheritdoc IUniswap
    // function collect(IUniswap.CollectParams calldata params)
    //     external
    //     payable
    //     returns (uint256 amount0, uint256 amount1)
    // {
    //     INonfungiblePositionManager.CollectParams memory collectParams = INonfungiblePositionManager.CollectParams({
    //         tokenId: params.tokenId,
    //         recipient: msg.sender,
    //         amount0Max: params.amount0Max,
    //         amount1Max: params.amount1Max
    //     });
    //
    //     (amount0, amount1) = nfpm.collect(collectParams);
    //
    //     _sendToOwner(params.tokenId, amount0, amount1);
    // }

    /// @inheritdoc IUniswap
    function increaseLiquidity(IUniswap.IncreaseLiquidityParams calldata params)
        external
        payable
        returns (uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        uint256 tokensLen = params.permit.permitted.length;

        ISignatureTransfer.SignatureTransferDetails[] memory details =
            new ISignatureTransfer.SignatureTransferDetails[](tokensLen);

        details[0].to = address(this);
        details[0].requestedAmount = params.permit.permitted[0].amount;

        if (tokensLen > 1) {
            details[1].to = address(this);
            details[1].requestedAmount = params.permit.permitted[1].amount;
        }

        permit2.permitTransferFrom(params.permit, details, msg.sender, params.signature);

        INonfungiblePositionManager.IncreaseLiquidityParams memory increaseParams = INonfungiblePositionManager
            .IncreaseLiquidityParams({
            tokenId: params.tokenId,
            amount0Desired: params.amountAdd0,
            amount1Desired: params.amountAdd1,
            amount0Min: params.amount0Min,
            amount1Min: params.amount1Min,
            deadline: block.timestamp
        });

        uint value = msg.value - params.proxyFee;

        (liquidity, amount0, amount1) = nfpm.increaseLiquidity{value: value}(increaseParams);
    }

    // /// @inheritdoc IUniswap
    // function decreaseLiquidity(IUniswap.DecreaseLiquidityParams calldata params)
    //     external
    //     payable
    //     returns (uint256 amount0, uint256 amount1)
    // {
    //     INonfungiblePositionManager.DecreaseLiquidityParams memory decreaseParams = INonfungiblePositionManager
    //         .DecreaseLiquidityParams({
    //         tokenId: params.tokenId,
    //         liquidity: params.liquidity,
    //         amount0Min: params.amount0Min,
    //         amount1Min: params.amount1Min,
    //         deadline: block.timestamp
    //     });
    //
    //     (amount0, amount1) = nfpm.decreaseLiquidity(decreaseParams);
    //
    //     _sendToOwner(params.tokenId, amount0, amount1);
    // }

    /// @notice Transfers funds to owner of NFT
    /// @param _tokenId The id of the erc721
    /// @param _amount0 The amount of token0
    /// @param _amount1 The amount of token1
    function _sendToOwner(uint256 _tokenId, uint256 _amount0, uint256 _amount1) internal {
        (, address owner, address token0, address token1,,,,,,,,) = nfpm.positions(_tokenId);

        IERC20(token0).safeTransfer(owner, _amount0);
        IERC20(token1).safeTransfer(owner, _amount1);
    }
}
