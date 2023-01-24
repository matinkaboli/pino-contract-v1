// SPDX-License-Identifier: MIT
pragma solidity =0.8.16;

import "../IWETH9.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ICToken is IERC20 {
    function mint() external payable;
    function mint(uint256 mintAmount) external returns (uint256);
    function redeem(uint256 redeemTokens) external returns (uint256);
    function balanceOfUnderlying(address account) external returns (uint256);
}

contract Compound is Ownable {
    using SafeERC20 for IERC20;

    mapping(address => mapping(address => bool)) private alreadyApprovedTokens;

    error FailedToSendEther();

    constructor(address[] memory _tokens, address[] memory _cTokens) {
        for (uint8 i = 0; i < _tokens.length; i += 1) {
            IERC20(_tokens[i]).safeApprove(_cTokens[i], type(uint256).max);

            alreadyApprovedTokens[_tokens[i]][_cTokens[i]] = true;
        }
    }

    function supply(address _token, address _cToken, uint256 _amount) public payable {
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        if (!alreadyApprovedTokens[_token][_cToken]) {
            IERC20(_token).approve(_cToken, type(uint256).max);

            alreadyApprovedTokens[_token][_cToken] = true;
        }

        uint256 balanceBefore = ICToken(_cToken).balanceOf(address(this));

        ICToken(_cToken).mint(_amount);

        uint256 balanceAfter = ICToken(_cToken).balanceOf(address(this));

        ICToken(_cToken).transfer(msg.sender, balanceAfter - balanceBefore);
    }

    function supplyETH(address _cToken, uint256 _fee) public payable {
        require(msg.value > 0 && msg.value > _fee);

        uint256 ethPrice = msg.value - _fee;

        uint256 balanceBefore = ICToken(_cToken).balanceOf(address(this));

        ICToken(_cToken).mint{value: ethPrice}();

        uint256 balanceAfter = ICToken(_cToken).balanceOf(address(this));

        ICToken(_cToken).transfer(msg.sender, balanceAfter - balanceBefore);
    }

    function withdraw(address _token, address _cToken, uint256 _amount) public payable {
        ICToken(_cToken).transferFrom(msg.sender, address(this), _amount);

        uint256 balanceBefore = ICToken(_token).balanceOf(address(this));

        ICToken(_cToken).redeem(_amount);

        uint256 balanceAfter = ICToken(_token).balanceOf(address(this));

        ICToken(_token).transfer(msg.sender, balanceAfter - balanceBefore);
    }

    function withdrawETH(address _cToken, uint256 _amount) public payable {
        ICToken(_cToken).transferFrom(msg.sender, address(this), _amount);

        uint256 balanceBefore = address(this).balance;

        ICToken(_cToken).redeem(_amount);

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
