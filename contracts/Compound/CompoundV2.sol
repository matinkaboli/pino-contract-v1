// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "../interfaces/Permit2.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ICToken is IERC20 {
    function mint() external payable;
    function mint(uint256 mintAmount) external returns (uint256);
    function redeem(uint256 redeemTokens) external returns (uint256);
    function balanceOfUnderlying(address account) external returns (uint256);
}

/// @title Compound V2 proxy
/// @author Matin Kaboli
/// @notice Supplies and Withdraws ERC20 and ETH tokens and helps with WETH wrapping
/// @dev This contract uses Permit2
contract Compound is Ownable {
    using SafeERC20 for IERC20;

    address public immutable permit2;
    mapping(address => mapping(address => bool)) private alreadyApprovedTokens;

    error FailedToSendEther();

    /// @notice Receives tokens and cTokens and approves them
    /// @param _permit2 Address of Permit2 contract
    /// @param _tokens List of ERC20 tokens used in Compound V2
    /// @param _cTokens List of ERC20 cTokens used in Compound V2
    constructor(address _permit2, address[] memory _tokens, address[] memory _cTokens) {
        permit2 = _permit2;

        for (uint8 i = 0; i < _tokens.length; i += 1) {
            IERC20(_tokens[i]).safeApprove(_cTokens[i], type(uint256).max);

            alreadyApprovedTokens[_tokens[i]][_cTokens[i]] = true;
        }
    }
    //
    /// @notice Approves an ERC20 token to lendingPool
    /// @param _token ERC20 token address

    function approveToken(address _token, address _cToken) public onlyOwner {
        IERC20(_token).safeApprove(_cToken, type(uint256).max);

        alreadyApprovedTokens[_token][_cToken] = true;
    }

    /// @notice Supplies an ERC20 asset to Compound
    /// @param _permit Permit2 PermitTransferFrom struct, includes receiver, token and amount
    /// @param _signature Signature, used by Permit2
    function supply(ISignatureTransfer.PermitTransferFrom calldata _permit, bytes calldata _signature, address _cToken)
        public
        payable
    {
        Permit2(permit2).permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );

        uint256 balanceBefore = ICToken(_cToken).balanceOf(address(this));

        ICToken(_cToken).mint(_permit.permitted.amount);

        uint256 balanceAfter = ICToken(_cToken).balanceOf(address(this));

        ICToken(_cToken).transfer(msg.sender, balanceAfter - balanceBefore);
    }

    /// @notice Supplies ETH to Compound
    /// @param _cToken address of cETH
    /// @param _fee Fee of the protocol (could be 0)
    function supplyETH(address _cToken, uint256 _fee) public payable {
        require(msg.value > 0 && msg.value > _fee);

        uint256 ethPrice = msg.value - _fee;

        uint256 balanceBefore = ICToken(_cToken).balanceOf(address(this));

        ICToken(_cToken).mint{value: ethPrice}();

        uint256 balanceAfter = ICToken(_cToken).balanceOf(address(this));

        ICToken(_cToken).transfer(msg.sender, balanceAfter - balanceBefore);
    }

    /// @notice Withdraws an ERC20 token and transfers it to msg.sender
    /// @param _permit Permit2 PermitTransferFrom struct, includes receiver, token and amount
    /// @param _signature Signature, used by Permit2
    /// @param _token received ERC20 token
    function withdraw(ISignatureTransfer.PermitTransferFrom calldata _permit, bytes calldata _signature, address _token)
        public
        payable
    {
        Permit2(permit2).permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );

        uint256 balanceBefore = ICToken(_token).balanceOf(address(this));

        ICToken(_permit.permitted.token).redeem(_permit.permitted.amount);

        uint256 balanceAfter = ICToken(_token).balanceOf(address(this));

        ICToken(_token).transfer(msg.sender, balanceAfter - balanceBefore);
    }

    /// @notice Received cETH and unwraps it to ETH and transfers it to msg.sender
    /// @param _permit Permit2 PermitTransferFrom struct, includes receiver, token and amount
    /// @param _signature Signature, used by Permit2
    function withdrawETH(ISignatureTransfer.PermitTransferFrom calldata _permit, bytes calldata _signature)
        public
        payable
    {
        Permit2(permit2).permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );

        uint256 balanceBefore = address(this).balance;

        ICToken(_permit.permitted.token).redeem(_permit.permitted.amount);

        uint256 balanceAfter = address(this).balance;

        (bool success,) = msg.sender.call{value: balanceAfter - balanceBefore}("");
        if (!success) revert FailedToSendEther();
    }

    /// @notice Withdraws fees and transfers them to owner
    function withdrawAdmin() public onlyOwner {
        require(address(this).balance > 0);

        payable(owner()).transfer(address(this).balance);
    }

    receive() external payable {}
}
