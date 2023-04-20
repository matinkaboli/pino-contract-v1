// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
pragma abicoder v2;

import "./ILido.sol";
import "../Proxy.sol";
import "../interfaces/IWETH9.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Lido is Proxy {
    using SafeERC20 for IERC20;

    ILido public immutable lido;
    IWETH9 public immutable weth;

    constructor(Permit2 _permit2, ILido _lido, IWETH9 _weth) Proxy(_permit2) {
        lido = _lido;
        weth = _weth;
    }

    function unwrapWETH9() public payable {
        uint256 balanceWETH9 = weth.balanceOf(address(this));

        if (balanceWETH9 > 0) {
            weth.withdraw(balanceWETH9);
        }
    }

    function sweepToken(IERC20 _token) private {
        uint256 balanceOf = _token.balanceOf(address(this));

        _token.safeTransfer(msg.sender, balanceOf);
    }

    function sweepSteth() private {
        uint256 shares = lido.sharesOf(address(this));

        lido.transferShares(msg.sender, shares);
    }

    function supply(uint256 _proxyFee) external payable {
        lido.submit{value: msg.value - _proxyFee}(msg.sender);

        sweepSteth();
    }

    function supplyWeth(ISignatureTransfer.PermitTransferFrom calldata _permit, bytes calldata _signature)
        external
        payable
    {
        require(_permit.permitted.token == address(weth));

        permit2.permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );

        unwrapWETH9();

        lido.submit{value: _permit.permitted.amount}(msg.sender);

        sweepSteth();
    }
}
