// SPDX-License-Identifier: MIT
pragma solidity =0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ILendingPool {
    function withdraw(address asset, uint256 amount, address to) external;
    function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

interface IWethGateway {
    function depositETH(address lendingPool, address onBehalfOf, uint16 referralCode) external payable;
    function withdrawETH(address lendingPool, uint256 amount, address to) external;
}

/// @title Aave LendingPool proxy contract
/// @author Matin Kaboli
/// @notice Deposits and Withdraws ERC20 tokens to the lending pool
contract LendingPool is Ownable {
    using SafeERC20 for IERC20;

    address public lendingPool;
    address public wethGateway;
    mapping(address => mapping(address => bool)) private alreadyApprovedTokens;

    /// @notice Sets LendingPool address and approves assets and aTokens to it
    /// @param _lendingPool Aave lending pool address
    /// @param _tokens ERC20 tokens, they're approved beforehand
    /// @param _aTokens underlying ERC20 tokens, they're approved beforehand
    constructor(address _lendingPool, address _wethGateway, address[] memory _tokens, address[] memory _aTokens) {
        lendingPool = _lendingPool;
        wethGateway = _wethGateway;

        for (uint8 i = 0; i < _tokens.length; i += 1) {
            IERC20(_tokens[i]).safeApprove(_lendingPool, type(uint256).max);

            alreadyApprovedTokens[_lendingPool][_tokens[i]] = true;
        }

        for (uint8 i = 0; i < _aTokens.length; i += 1) {
            IERC20(_aTokens[i]).safeApprove(_lendingPool, type(uint256).max);

            alreadyApprovedTokens[_lendingPool][_aTokens[i]] = true;
        }
    }

    /// @notice Sets LendingPool address and approves assets and aTokens to it
    /// @param _lendingPool Aave lending pool address
    /// @param _tokens ERC20 tokens, they're approved beforehand
    /// @param _aTokens underlying ERC20 tokens, they're approved beforehand
    function changeLendingPoolAddress(address _lendingPool, address[] memory _tokens, address[] memory _aTokens)
        public
        onlyOwner
    {
        lendingPool = _lendingPool;

        for (uint8 i = 0; i < _tokens.length; i += 1) {
            IERC20(_tokens[i]).safeApprove(_lendingPool, type(uint256).max);

            alreadyApprovedTokens[_lendingPool][_tokens[i]] = true;
        }

        for (uint8 i = 0; i < _aTokens.length; i += 1) {
            IERC20(_aTokens[i]).safeApprove(_lendingPool, type(uint256).max);

            alreadyApprovedTokens[_lendingPool][_aTokens[i]] = true;
        }
    }

    /// @notice Sets the new WethGateway address
    /// @param _wethGateway The new WethGateway address
    function changeWethGatewayAddress(address _wethGateway) public onlyOwner {
        wethGateway = _wethGateway;
    }

    /// @notice Deposits an ERC20 token to the pool and sends the underlying aToken to msg.sender
    /// @param _token ERC20 token to deposit
    /// @param _amount Amount of token to deposit
    function deposit(address _token, uint256 _amount) public payable {
        IERC20(_token).transferFrom(msg.sender, address(this), _amount);

        if (!alreadyApprovedTokens[lendingPool][_token]) {
            IERC20(_token).safeApprove(lendingPool, type(uint256).max);

            alreadyApprovedTokens[lendingPool][_token] = true;
        }

        ILendingPool(lendingPool).deposit(_token, _amount, msg.sender, 0);
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
    /// @param _aToken underlying ERC20 token to withdraw
    /// @param _token ERC20 token to receive
    /// @param _amount Amount of token to withdraw and receive
    function withdraw(address _token, address _aToken, uint256 _amount) public payable {
        IERC20(_aToken).transferFrom(msg.sender, address(this), _amount);

        if (!alreadyApprovedTokens[lendingPool][_token]) {
            IERC20(_token).safeApprove(lendingPool, type(uint256).max);

            alreadyApprovedTokens[lendingPool][_token] = true;
        }

        if (!alreadyApprovedTokens[lendingPool][_aToken]) {
            IERC20(_aToken).safeApprove(lendingPool, type(uint256).max);

            alreadyApprovedTokens[lendingPool][_aToken] = true;
        }

        ILendingPool(lendingPool).withdraw(address(_token), _amount, msg.sender);
    }

    function withdrawETH(address _aToken, uint256 _amount) public payable {
        IERC20(_aToken).transferFrom(msg.sender, address(this), _amount);

        if (!alreadyApprovedTokens[wethGateway][_aToken]) {
            IERC20(_aToken).safeApprove(wethGateway, type(uint256).max);

            alreadyApprovedTokens[wethGateway][_aToken] = true;
        }

        IWethGateway(wethGateway).withdrawETH(lendingPool, _amount, msg.sender);
    }

    /// @notice Withdraws fees and transfers them to owner
    function withdrawAdmin() public onlyOwner {
        require(address(this).balance > 0);

        payable(owner()).transfer(address(this).balance);
    }

    receive() external payable {}
}
