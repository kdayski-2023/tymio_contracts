// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.5 <0.9.0;
pragma abicoder v2;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./interface/Tokens.sol";
import "./lib/ArrayUtils.sol";
import "./lib/SafeMath.sol";

contract PayerV3 {    
    using SafeMath for uint256;
    using ArrayUtils for address[];    
    address public owner1;
    address public owner2;
    address public service;
    struct Order {
        address user;
        address tokenIn;
        uint256 amountIn;
        address tokenOut;
        uint256 amountOut;
        uint256 price;
        uint256 additionalAmount;
        uint256 endTimestamp;
        bool completed;
        bool claimed;
    }
    struct ExecuteOrderParams {
        uint256[] orderIds;
        bool[] swap;
        uint256[] additionalAmount;
    }
    struct SwapParams {
        address[] tokenIn;
        address[] tokenOut;
        uint256[] amount;
    }
    constructor() {
        owner1 = msg.sender;
        payerAddress = owner1;
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
    ISwapRouter public swapRouter = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    uint24 poolFee = 3000; 
    uint24 maxAdditionalAmountPercentage  = 500;
    uint256 swapDeadline  = 10 minutes;
    mapping(address => mapping(address => uint256)) public balances;
    mapping(address => mapping(address => uint256)) public swapsIn;
    mapping(address => mapping(address => uint256)) public swapsOut;
    mapping(address => uint256) public lastUserActionTime;
    Order[] public orders;
    mapping(address => bool) public acceptableTokens;
    mapping(address => bool) public isUsdToken; 
    address[] public acceptableTokensArray;
    address public wethAddress;
    address public payerAddress;
    uint maxDuration = 90 days;
    uint maxExecutionTime = 1 seconds;//! IN PROD SET 1 hours
    uint fullAccessAfter = 10 seconds;//! IN PROD SET 360 days
    event Deposit(address indexed user,address indexed token, uint256 amount);
    event NewOrder(uint256 indexed orderId, address indexed user, address indexed token, uint256 amount, uint256 duration);
    
    function depositAndOrder(
        address _tokenAddressIn,
        address _tokenAddressOut,
        uint256 _amount,
        uint256 _price,
        uint256 _duration
    )public{
        deposit(_tokenAddressIn, _amount);
        makeOrder(_tokenAddressIn, _tokenAddressOut, _amount, _price, _duration);
    }
    function depositEthAndOrder(
        address _tokenAddressOut,
        uint256 _amount,
        uint256 _price,
        uint256 _duration
    )public payable{
        depositEth();
        makeOrder(wethAddress, _tokenAddressOut, _amount, _price, _duration);
    }
    function makeOrder(
        address _tokenAddressIn,
        address _tokenAddressOut,
        uint256 _amountIn,
        uint256 _price,
        uint256 _duration
    ) public {
        require(balances[_tokenAddressIn] [msg.sender]>=_amountIn, "NO TOKEN BALANCE");
        require(_tokenAddressIn != _tokenAddressOut, "SAME TOKENS");
        require(_duration < maxDuration, "DURATION MORE MAXIMUM");
        balances[_tokenAddressIn][msg.sender] = balances[_tokenAddressIn][msg.sender].sub(_amountIn);
        orders.push(Order(msg.sender, _tokenAddressIn, _amountIn, _tokenAddressOut, 0, _price, 0, block.timestamp + _duration, false , false ));
        emit NewOrder(orders.length - 1, msg.sender, address(_tokenAddressIn), _amountIn, _duration);
    }
    function deposit(
        address _tokenAddress,
        uint256 _amount
    ) public payable {
        require(acceptableTokens[ address(_tokenAddress)], "NOT ALLOWED TOKEN");        
        balances[_tokenAddress][msg.sender] = balances[_tokenAddress][msg.sender].add(_amount);
        require(IERC20(_tokenAddress).transferFrom(msg.sender, address(this), _amount), "TRANSFER FROM ERROR");        
        _updateUserActionTime();
        emit Deposit(msg.sender, address(_tokenAddress),_amount);
    }
    function depositEth() public payable {
        require(acceptableTokens[ address(_tokenAddress)], "NOT ALLOWED TOKEN");        
        IWETH9(wethAddress).deposit{ value: msg.value }();
        balances[wethAddress][msg.sender] = balances[wethAddress][msg.sender].add(msg.value) ;
        _updateUserActionTime();
        emit Deposit(msg.sender, wethAddress, msg.value);
    }
    function executeOrders(ExecuteOrderParams calldata params, uint256[] calldata amountOutMinimum) public onlyOwnerOrService {
        require(params.orderIds.length == params.swap.length && params.swap.length == params.additionalAmount.length, "DIFFERENT LENGTH");
        for (uint256 i = 0; i < params.orderIds.length; i++) {       
            require(block.timestamp >= orders[params.orderIds[i]].endTimestamp, "WRONG EXPIRATION TIME");
            require(!orders[params.orderIds[i]].claimed, "ORDER ALREADY CLAIMED");
            if(params.swap[i]){
                swapsIn[orders[params.orderIds[i]].tokenIn][orders[params.orderIds[i]].tokenOut] += orders[params.orderIds[i]].amountIn;
            }
        }
        uint256 swapsCount;
        for (uint256 i = 0; i < acceptableTokensArray.length; i++) {
            for (uint256 j = 0; j < acceptableTokensArray.length; j++) {
                if(swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]]>0){
                    ISwapRouter.ExactInputSingleParams memory swapParams = ISwapRouter
                        .ExactInputSingleParams({
                            tokenIn: acceptableTokensArray[i],
                            tokenOut: acceptableTokensArray[j],
                            fee: poolFee,
                            recipient: address(this),
                            deadline: block.timestamp + swapDeadline,
                            amountIn: swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]],
                            amountOutMinimum: amountOutMinimum[swapsCount], 
                            sqrtPriceLimitX96: 0 
                        });
                    uint256 amountOut = swapRouter.exactInputSingle(swapParams);
                    require(amountOut > amountOutMinimum[swapsCount], "INCORRECT AMOUNT OUT");
                    swapsOut[acceptableTokensArray[i]][acceptableTokensArray[j]] = amountOut;                    
                    swapsCount++;
                }
            }
        }
        for (uint256 i = 0; i < params.orderIds.length; i++) {       
             _executeOrder(params.orderIds[i], params.swap[i],params.additionalAmount[i]);            
        }
        for (uint256 i = 0; i < acceptableTokensArray.length; i++) {
            for (uint256 j = 0; j < acceptableTokensArray.length; j++) {
                swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]] = 0; 
            }
        }
    }
    function _executeOrder(uint256 orderId, bool swap, uint256 additionalAmount) private {
            Order storage order = orders[orderId];
            order.additionalAmount = additionalAmount;
            order.completed = true;
            if(swap){
                uint256 accuracy = wethAddress == order.tokenOut ? 1e10 : 10 ** IERC20(order.tokenOut).decimals(); 
                uint256 proportionIn = calculateProportion(swapsIn[order.tokenIn][order.tokenOut], order.amountIn, accuracy);
                uint256 swapAmountOut = swapsOut[order.tokenIn][order.tokenOut].mul(accuracy).div(proportionIn);
                uint256 remainder;                  
                if(isUsdToken[order.tokenIn]){ 
                    remainder = swapAmountOut - order.amountIn * 10 ** IERC20(order.tokenOut).decimals() / order.price;
                    require(order.additionalAmount < calculatePercentage(order.amountIn, maxAdditionalAmountPercentage), "WRONG ADDITIONAL AMOUNT");
                }else{                    
                    remainder = swapAmountOut - order.amountIn * order.price / 10 ** IERC20(order.tokenIn).decimals();
                    require(order.additionalAmount < calculatePercentage(swapAmountOut.sub(remainder), maxAdditionalAmountPercentage), "WRONG ADDITIONAL AMOUNT");
                }
                order.amountOut = swapAmountOut.sub(remainder);
                balances[order.tokenOut][payerAddress] = balances[order.tokenOut][payerAddress].add(remainder);
            }else{
                order.tokenOut = order.tokenIn;
                order.amountOut = order.amountIn;
            }
    }
    function calculatePercentage(
        uint256 _quantity,
        uint256 _percentage
    ) public pure returns (uint256) {
        return _quantity.mul(_percentage).div(10000);
    }
     function calculateProportion(
        uint256 _quantity,
        uint256 _total,
        uint256 _accuracy
    ) public pure returns (uint256) {
        return _quantity.mul(_accuracy).div(_total);
    }

    function claimOrder(
        uint256 _orderId,
        address _usdToken,
        bool _force
    ) public {
        Order storage order = orders[_orderId];
        require(!order.claimed, "ORDER ALREADY CLAIMED");
        require(order.completed || block.timestamp > order.endTimestamp + maxExecutionTime, "ORDER NOT COMPLETED" );
        if(!_force){
            require(isUsdToken[_usdToken], "IS NOT USD TOKEN" );
            if(order.additionalAmount > 0 && balances[_usdToken][payerAddress] >= order.additionalAmount){
                _balanceTransfer(_usdToken, payerAddress, order.user, order.additionalAmount);
            }
        }else{
            require(msg.sender == order.user, "AVAILABLE ONLY OWNER");
        }
        if(!order.completed && block.timestamp > order.endTimestamp + maxExecutionTime){
            order.tokenOut = order.tokenIn;
            order.amountOut = order.amountIn;
        }
        balances[order.tokenOut][order.user] = balances[order.tokenOut][order.user].add(order.amountOut);
        order.claimed = true;
        if(msg.sender == order.user){
            _updateUserActionTime();
        }
    }
    function fullWithdrawal(
        address _tokenAddress,
        uint256 _amount
    ) public {
        require(balances[_tokenAddress][msg.sender] >= _amount, "NOT ENOUGH TOKENS ON THE BALANCE" );
        balances[_tokenAddress][msg.sender] = balances[_tokenAddress][msg.sender].sub(_amount);
        IERC20(_tokenAddress).transfer(msg.sender, _amount);
    }
    function fullWithdrawalETH(        
        uint256 _amount
    ) public payable {
        require(balances[wethAddress][msg.sender] >= _amount, "NOT ENOUGH WETH TOKENS ON THE BALANCE" );
        balances[wethAddress][msg.sender] = balances[wethAddress][msg.sender].sub(_amount);
        IWETH9(wethAddress).withdraw(_amount);
        (bool sent, ) = msg.sender.call{value: _amount}("");
        require(sent, "Failed to send Ether");
    }

    function balanceOf(
        address _tokenAddress,
        address _user
    ) public view returns (uint256) {
        return balances[_tokenAddress] [_user] ;
    }
    function _balanceTransfer(
        address _tokenAddress,
        address _sender,
        address _recipient,
        uint256 _amount
    ) internal {
        balances[_tokenAddress][_sender] = balances[_tokenAddress][_sender].sub(_amount);
        balances[_tokenAddress][_recipient] = balances[_tokenAddress][_recipient].add(_amount);
    }
    function _updateUserActionTime() internal {
        lastUserActionTime[msg.sender] = block.timestamp;
    }
    function editAcceptableToken(address _token, bool _value, bool _isUsd) public onlyOwners {
        acceptableTokens[_token] = _value;
        isUsdToken[_token] = _isUsd;
        if(_value){
            acceptableTokensArray.push(_token);
        }else{
            acceptableTokensArray.deleteItem(_token);
        }
    }

    function getEthBalance() public view returns (uint256) {
        return address(this).balance;
    }
    function getBackEth(
        address payable _to,
        uint256 _amount
    ) external payable onlyOwners {
        (bool sent, ) = _to.call{value: _amount}("");
        require(sent, "Failed to send Ether");
    }
    function emergencyQuit(
        address _user,
        address  _tokenAddress,
        uint256 _amount
    ) external onlyOwners {
        require(block.timestamp > lastUserActionTime[_user] + fullAccessAfter);
        _balanceTransfer(_tokenAddress, _user, payerAddress, _amount);
    }
    
    function getTokenBalance(IERC20 token) public view returns (uint256) {
        return token.balanceOf(address(this));
    }
    function setSwapRouter(address _router) external onlyOwners {
        swapRouter = ISwapRouter(_router);
    }
    function setWeth(address _wethAddress) external onlyOwners {
        wethAddress = _wethAddress;
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
    function setPayerAddress(address _address) external onlyOwners {
        payerAddress = _address;
    }
    function setPoolFee(uint24 _poolFee) external onlyOwners {
        poolFee = _poolFee;
    }
    function setMaxAdditionalAmountPercentage(uint24 _maxAdditionalAmountPercentage) external onlyOwners {
        maxAdditionalAmountPercentage = _maxAdditionalAmountPercentage;
    }
    
}