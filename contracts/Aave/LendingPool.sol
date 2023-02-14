// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "../Proxy.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ILendingPool {
    function withdraw(address asset, uint256 amount, address to) external;
    function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

interface IWethGateway {
    function withdrawETH(address lendingPool, uint256 amount, address to) external;
    function depositETH(address lendingPool, address onBehalfOf, uint16 referralCode) external payable;
}

/// @title Aave LendingPool proxy contract
/// @author Matin Kaboli
/// @notice Deposits and Withdraws ERC20 tokens to the lending pool
/// @dev This contract uses Permit2
contract LendingPool is Proxy {
    using SafeERC20 for IERC20;

    address public lendingPool;
    address public wethGateway;
    mapping(address => mapping(address => bool)) private alreadyApprovedTokens;

    /// @notice Sets LendingPool address and approves assets and aTokens to it
    /// @param _lendingPool Aave lending pool address
    /// @param _wethGateway Aave WethGateway contract address
    /// @param _permit2 Address of Permit2 contract
    /// @param _tokens ERC20 tokens, they're approved beforehand
    /// @param _aTokens underlying ERC20 tokens, they're approved beforehand
    constructor(
        address _lendingPool,
        address _wethGateway,
        Permit2 _permit2,
        address[] memory _tokens,
        address[] memory _aTokens
    ) Proxy(_permit2) {
        lendingPool = _lendingPool;
        wethGateway = _wethGateway;

        for (uint8 i = 0; i < _tokens.length; ++i) {
            IERC20(_tokens[i]).safeApprove(_lendingPool, type(uint256).max);

            alreadyApprovedTokens[_tokens[i]][_lendingPool] = true;
        }

        for (uint8 i = 0; i < _aTokens.length; ++i) {
            IERC20(_aTokens[i]).safeApprove(_lendingPool, type(uint256).max);

            alreadyApprovedTokens[_aTokens[i]][_lendingPool] = true;
        }
    }

    /// @notice Sets LendingPool address and approves assets and aTokens to it
    /// @param _lendingPool Aave lending pool address
    function changeLendingPoolAddress(address _lendingPool) public onlyOwner {
        lendingPool = _lendingPool;
    }

    /// @notice Sets the new WethGateway address
    /// @param _wethGateway The new WethGateway address
    function changeWethGatewayAddress(address _wethGateway) public onlyOwner {
        wethGateway = _wethGateway;
    }

    /// @notice Approves an ERC20 token to lendingPool
    /// @param _token ERC20 token address
    function approveToken(address _token) public onlyOwner {
        IERC20(_token).safeApprove(lendingPool, type(uint256).max);

        alreadyApprovedTokens[_token][lendingPool] = true;
    }

    /// @notice Approves an ERC20 token to wethGateway
    /// @param _token ERC20 token address
    function approveTokenToWethGateway(address _token) public onlyOwner {
        IERC20(_token).safeApprove(wethGateway, type(uint256).max);

        alreadyApprovedTokens[_token][wethGateway] = true;
    }

    /// @notice Deposits an ERC20 token to the pool and sends the underlying aToken to msg.sender
    /// @param _permit Permit2 PermitTransferFrom struct, includes receiver, token and amount
    /// @param _signature Signature, used by Permit2
    function deposit(ISignatureTransfer.PermitTransferFrom calldata _permit, bytes calldata _signature)
        public
        payable
    {
        permit2.permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );

        ILendingPool(lendingPool).deposit(_permit.permitted.token, _permit.permitted.amount, msg.sender, 0);
    }

    /// @notice Transfers ETH to WethGateway, then WethGateway converts ETH to WETH and deposits
    /// it to the pool and sends the underlying aToken to msg.sender
    /// @param _fee Fee of the proxy
    function depositETH(uint256 _fee) public payable {
        require(msg.value > 0 && msg.value > _fee);

        uint256 ethValue = msg.value - _fee;

        IWethGateway(wethGateway).depositETH{value: ethValue}(lendingPool, msg.sender, 0);
    }

    /// @notice Receives underlying aToken and sends ERC20 token to msg.sender
    /// @param _permit Permit2 PermitTransferFrom struct, includes aToken and amount
    /// @param _signature Signature, used by Permit2
    /// @param _token ERC20 token to receive
    function withdraw(ISignatureTransfer.PermitTransferFrom calldata _permit, bytes calldata _signature, address _token)
        public
        payable
    {
        permit2.permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );

        ILendingPool(lendingPool).withdraw(_token, _permit.permitted.amount, msg.sender);
    }

    /// @notice Receives underlying A_WETH and sends ETH token to msg.sender
    /// @param _permit Permit2 PermitTransferFrom struct, includes aToken and amount
    /// @param _signature Signature, used by Permit2
    function withdrawETH(ISignatureTransfer.PermitTransferFrom calldata _permit, bytes calldata _signature)
        public
        payable
    {
        permit2.permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );

        IWethGateway(wethGateway).withdrawETH(lendingPool, _permit.permitted.amount, msg.sender);
    }
}
