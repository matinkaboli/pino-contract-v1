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

import "./helpers/ErrorCodes.sol";
import "./interfaces/IWETH9.sol";
import "./interfaces/Permit2/Permit2.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Proxy is Ownable {
    using SafeERC20 for IERC20;

    error ProxyError(uint256 errCode);

    IWETH9 public immutable WETH;
    Permit2 public immutable permit2;

    /// @notice Proxy contract constructor, sets permit2 and weth addresses
    /// @param _permit2 Permit2 contract address
    /// @param _weth WETH9 contract address
    constructor(Permit2 _permit2, IWETH9 _weth) {
        WETH = _weth;
        permit2 = _permit2;
    }

    /// @notice Withdraws fees and transfers them to owner
    /// @param _recipient Address of the destination receiving the fees
    function withdrawAdmin(address _recipient) public onlyOwner {
        require(address(this).balance > 0);

        _sendETH(_recipient, address(this).balance);
    }

    /// @notice Approves an ERC20 token to lendingPool and wethGateway
    /// @param _token ERC20 token address
    /// @param _spenders ERC20 token address
    function approveToken(address _token, address[] calldata _spenders) external {
        for (uint8 i = 0; i < _spenders.length;) {
            _approve(_token, _spenders[i]);

            unchecked {
                ++i;
            }
        }
    }

    /// @notice Handles custom error codes
    /// @param _condition The condition, if it's false then execution is reverted
    /// @param _code Custom code, listed in Errors.sol
    function _require(bool _condition, uint256 _code) internal pure {
        if (!_condition) {
            revert ProxyError(_code);
        }
    }

    /// @notice Sweeps contract tokens to msg.sender
    /// @notice _token ERC20 token address
    function _sweepToken(address _token) internal {
        uint256 balanceOf = IERC20(_token).balanceOf(address(this));

        if (balanceOf > 0) {
            IERC20(_token).safeTransfer(msg.sender, balanceOf);
        }
    }

    /// @notice Transfers ERC20 token to recipient
    /// @param _recipient The destination address
    /// @param _token ERC20 token address
    /// @param _amount Amount to transfer
    function _send(address _token, address _recipient, uint256 _amount) internal {
        IERC20(_token).safeTransfer(_recipient, _amount);
    }

    /// @notice Permits _spender to spend max amount of ERC20 from the contract
    /// @param _token ERC20 token address
    /// @param _spender Spender address
    function _approve(address _token, address _spender) internal {
        IERC20(_token).safeApprove(_spender, type(uint256).max);
    }

    /// @notice Sends ETH to the destination
    /// @param _recipient The destination address
    /// @param _amount Ether amount
    function _sendETH(address _recipient, uint256 _amount) internal {
        (bool success,) = payable(_recipient).call{value: _amount}("");

        _require(success, ErrorCodes.FAILED_TO_SEND_ETHER);
    }

    /// @notice Unwraps WETH9 to Ether and sends the amount to the recipient
    /// @param _recipient The destination address
    function _unwrapWETH9(address _recipient) internal {
        uint256 balanceWETH = WETH.balanceOf(address(this));

        if (balanceWETH > 0) {
            WETH.withdraw(balanceWETH);

            _sendETH(_recipient, balanceWETH);
        }
    }

    /// @notice Wraps ETH to WETH and sends to recipient
    /// @param _recipient The destination address
    /// @param _proxyFee Fee of the proxy contract
    function wrapWETH9(address _recipient, uint96 _proxyFee) external payable {
        uint256 value = msg.value - _proxyFee;

        WETH.deposit{value: value}();

        _send(address(WETH), _recipient, value);
    }

    /// @notice Receives WETH and unwraps it to ETH and sends to recipient
    /// @param _recipient The destination address
    /// @param _permit Permit2 PermitTransferFrom struct, includes receiver, token and amount
    /// @param _signature Signature, used by Permit2
    function unwrapWETH9(
        address _recipient,
        ISignatureTransfer.PermitTransferFrom calldata _permit,
        bytes calldata _signature
    ) external payable {
        _require(_permit.permitted.token == address(WETH), ErrorCodes.TOKENS_MISMATCHED);

        permit2.permitTransferFrom(
            _permit,
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: _permit.permitted.amount}),
            msg.sender,
            _signature
        );

        WETH.withdraw(_permit.permitted.amount);

        _sendETH(_recipient, _permit.permitted.amount);
    }
}
