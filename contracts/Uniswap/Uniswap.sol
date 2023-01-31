// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;
pragma abicoder v2;

import "../Proxy.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

contract Uniswap is Proxy {
    using SafeERC20 for IERC20;

    // struct ExactInputSingleWitness {
    //     uint24 fee;
    //     address tokenOut;
    //     uint160 sqrtPriceLimitX96;
    //     uint256 amountOutMinimum;
    // }

    // bytes32 private EXACT_INPUT_SINGLE_WITNESS_TYPEHASH = keccak256("Witness(uint24 fee,address tokenOut,uint160 sqrtPriceLimitX96,uint256 amountOutMinimum)");
    // string private constant EXACT_INPUT_SINGLE_WITNESS = "Witness witness)TokenPermissions(address token,uint256 amount)Witness(uint24 fee,address tokenOut,uint160 sqrtPriceLimitX96,uint256 amountOutMinimum)";

    ISwapRouter public immutable swapRouter;

    constructor(ISwapRouter _swapRouter, Permit2 _permit2, IERC20[] memory _tokens) Proxy(_permit2) {
        swapRouter = _swapRouter;

        for (uint8 i = 0; i < _tokens.length; ++i) {
            _tokens[i].safeApprove(address(_swapRouter), type(uint256).max);
        }
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
}
