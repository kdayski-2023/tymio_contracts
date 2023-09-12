// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.5 <0.9.0;
pragma abicoder v2;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./lib/ArrayUtils.sol";
import "hardhat/console.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function approve(address account, uint amount) external returns (bool);
    function transfer(
        address recipient,
        uint256 amount
    ) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);
}
interface IWETH9 is IERC20 {
    function deposit() external payable;
    function withdraw(uint256) external payable;
}
contract PayerV2 {
    using ArrayUtils for address[];
    address public owner1;
    address public owner2;
    address public service;
    
    constructor() payable {
        owner1 = msg.sender;
    }
    receive() external payable {}

    modifier onlyOwners() {
        require(msg.sender == owner1 || msg.sender == owner2, "NOT THE OWNERS");
        _;
    }
    modifier onlyOwnerOrService() {
        require(
            msg.sender == owner1 ||
                msg.sender == owner2 ||
                msg.sender == service,
            "NOT THE ALLOWED ADDRESS"
        );
        _;
    }

    mapping(uint256 => IERC20) public tokenAddress;
    mapping(uint256 => uint256) public amount;
    mapping(uint256 => address) public userAddress;
    uint256 public recordCount;
    bool public paid;
    bool public recorded;
    mapping(address => bool) public acceptableTokens; // Разрешенные токены
    address[] public acceptableTokensArray; // Разрешенные токены
    ISwapRouter public swapRouter = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    function create(
        IERC20[] calldata _tokenAddress,
        uint256[] calldata _amount,
        address[] calldata _userAddress
    ) public onlyOwnerOrService {
        require(recorded == false, "ALREADY RECORDED");
        require(_tokenAddress.length == _amount.length && _amount.length == _userAddress.length && _tokenAddress.length == _amount.length, "SAME LENGTH");
        recordCount = _tokenAddress.length;
        for (uint256 i = 0; i < recordCount; i++) {
            tokenAddress[i] = _tokenAddress[i];
            amount[i] = _amount[i];
            userAddress[i] = _userAddress[i];
        }
        paid = false;
        recorded = true;
    }

    function makePayment() public onlyOwners {
        require(paid == false, "ALREADY PAID");
        for (uint256 i = 0; i < recordCount; i++) {
            if(address(tokenAddress[i]) == address(0)){
                (bool sent, ) = payable(userAddress[i]).call{value: amount[i]}("");
                require(sent, "Failed to send Ether");
            }else{
                tokenAddress[i].transfer(userAddress[i], amount[i]);
            }
        }
        paid = true;
        recorded = false;
    }
    function swap(address _from, address _to, uint256 _amountIn, uint24 _poolFee)
        external onlyOwners
    {
        require(acceptableTokens[_from] && acceptableTokens[_to], "NOT ALLOWED TOKEN");
        IERC20(_from).approve(address(swapRouter), _amountIn);
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: _from,
                tokenOut: _to,
                fee: _poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: _amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        swapRouter.exactInputSingle(params);
    }
    function withdraw(address _token, uint256 _amount) 
        payable 
        external
        onlyOwners
    {
        IWETH9(_token).withdraw(_amount);
    }
    function setSwapRouter(address _router) external onlyOwners {
        swapRouter = ISwapRouter(_router);
    }
    function editAcceptableToken(address _token, bool _value) public onlyOwners {
        acceptableTokens[_token] = _value;
        if(_value){
            acceptableTokensArray.push(_token);
        }else{
            acceptableTokensArray.deleteItem(_token);
        }
    }
    function setRecorded(bool value) external onlyOwners {
        recorded = value;
    }
    function setPaid(bool value) external onlyOwners {
        paid = value;
    }

    function setServiceAddress(address _address) external onlyOwners {
        service = _address;
    }

    function setOwner1Address(address _address) external onlyOwners {
        owner1 = _address;
    }

    function setOwner2Address(address _address) external onlyOwners {
        owner2 = _address;
    }

    function getBackEth(
        address payable _to,
        uint256 _amount
    ) external payable onlyOwners {
        (bool sent, ) = _to.call{value: _amount}("");
        require(sent, "Failed to send Ether");
    }

    function getBackErc20(
        IERC20 _token,
        address _to,
        uint256 _amount
    ) external onlyOwners {
        _token.transfer(_to, _amount);
    }
    function approveToken(
        IERC20 _token,
        address _to,
        uint256 _amount
    ) external onlyOwners {
        IERC20(_token).approve(_to, _amount);
    }

    // ONLY FOR DEVELOP
    function getEthBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function getTokenBalance(IERC20 token) public view returns (uint256) {
        return token.balanceOf(address(this));
    }
    function getPayoutReport() public view returns (address[] memory, uint256[] memory,address[] memory) {
        address[] memory token = new address[](recordCount);
        uint256[] memory value = new uint256[](recordCount);
        address[] memory user = new address[](recordCount);
        for (uint256 i = 0; i < recordCount; i++) {            
            token[i] = address(tokenAddress[i]);
            value[i] = amount[i];
            user[i] = userAddress[i];
        }
        return (token, value, user);
    }
    function getPayoutAmount() public view returns (address[] memory, uint256[] memory) {
        address[] memory token = new address[](acceptableTokensArray.length);
        uint256[] memory value = new uint256[](acceptableTokensArray.length);
        for (uint256 i = 0; i < acceptableTokensArray.length; i++) {
            uint256 totalAmount;
            for (uint256 j = 0; j < recordCount; j++) {
                if(tokenAddress[j] == IERC20(acceptableTokensArray[i])){
                    totalAmount += amount[j];
                }
            }
            token[i] = acceptableTokensArray[i];
            value[i] = totalAmount;
        }
        return (token, value);
    }
    function isEnoughPayoutAmount() public view returns (bool isEnough) {
        (address[] memory token, uint256[] memory value) = getPayoutAmount();
        for (uint256 i = 0; i < token.length; i++) {
            if(IERC20(token[i]).balanceOf(address(this))< value[i]){
                return false;
            }
        }
        return true;
    }
}