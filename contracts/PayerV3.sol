// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.5 <0.9.0;
pragma abicoder v2;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./interface/Tokens.sol";
import "./lib/ArrayUtils.sol";
import "./lib/SafeMath.sol";
import "hardhat/console.sol";

contract PayerV3 {    
    using SafeMath for uint256;
    using ArrayUtils for address[];    
    address public owner1;
    address public owner2;
    address public service;
    struct Order {
        address user;
        IERC20 tokenIn;
        uint256 amountIn;
        IERC20 tokenOut;
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
    uint24 poolFee = 500; 
    uint24 maxAdditionalAmountPercentage  = 200; // !2% 
    
    uint256 swapDeadline  = 10 minutes;
    mapping(IERC20 => mapping(address => uint256)) public balances;
    mapping(address => mapping(address => uint256)) public swapsIn;
    mapping(address => mapping(address => uint256)) public swapsOut;
    mapping(address => uint256) public lastUserActionTime;
    Order[] public orders;
    mapping(address => bool) public acceptableTokens;
    mapping(address => bool) public isUsdToken; 
    address[] public acceptableTokensArray;
    address public wethAddress;
    uint maxDuration = 90 days;
    uint maxExecutionTime = 1 seconds;//! IN PROD SET 1 hours
    uint fullAccessAfter = 10 seconds;//! IN PROD SET 360 days
    event Deposit(address indexed user,address indexed token, uint256 amount);
    event NewOrder(uint256 indexed orderId, address indexed user, address indexed token, uint256 amount, uint256 duration);
    address public payerAddress;
    
    function depositAndOrder(
        IERC20 _tokenAddressIn,
        IERC20 _tokenAddressOut,
        uint256 _amount,
        uint256 _price,
        uint256 _duration
    )public{
        deposit(_tokenAddressIn, _amount);
        makeOrder(_tokenAddressIn,_tokenAddressOut, _amount, _price, _duration);
    }
    function depositEthAndOrder(
        IERC20 _tokenAddressIn,
        IERC20 _tokenAddressOut,
        uint256 _amount,
        uint256 _price,
        uint256 _duration
    )public payable{
        require(address(_tokenAddressIn) == wethAddress, "NOT WETH");
        depositEth();
        makeOrder(_tokenAddressIn,_tokenAddressOut, _amount, _price, _duration);
    }
    function makeOrder(
        IERC20 _tokenAddressIn,
        IERC20 _tokenAddressOut,
        uint256 _amountIn,
        uint256 _price,
        uint256 _duration
    ) public {
        require(balances[_tokenAddressIn] [msg.sender]>=_amountIn, "NO TOKEN BALANCE");
        // ! TODO MAX EPIRATION TIME CHECK
        balances[_tokenAddressIn] [msg.sender] = balances[_tokenAddressIn] [msg.sender].sub(_amountIn);
        orders.push(Order(msg.sender, _tokenAddressIn, _amountIn, _tokenAddressOut, 0, _price, 0, block.timestamp + _duration, false , false ));
        emit NewOrder(orders.length - 1, msg.sender, address(_tokenAddressIn), _amountIn, _duration);
    }
    function deposit(
        IERC20 _tokenAddress,
        uint256 _amount
    ) public payable {
        require(acceptableTokens[ address(_tokenAddress)], "NOT ALLOWED TOKEN");
        if(address(_tokenAddress) == wethAddress && msg.value > 0){
            require(_amount == msg.value, "AMOUNTS NOT MATCH");
            IWETH9(wethAddress).deposit{ value: msg.value }();
        }else{
            require(_tokenAddress.transferFrom(msg.sender, address(this), _amount), "TRANSFER FROM ERROR");
        }
        balances[_tokenAddress] [msg.sender] = balances[_tokenAddress] [msg.sender] + _amount;
        _updateUserActionTime();
        emit Deposit(msg.sender, address(_tokenAddress),_amount);
    }
    function depositEth() public payable {
        IWETH9(wethAddress).deposit{ value: msg.value }();
        balances[IERC20(wethAddress)] [msg.sender] = balances[IERC20(wethAddress)] [msg.sender].add(msg.value) ;
        _updateUserActionTime();
        emit Deposit(msg.sender, wethAddress, msg.value);
    }
    function executeOrders(ExecuteOrderParams calldata params, uint256[] calldata validateAmounts) public onlyOwners {
        require(params.orderIds.length == params.swap.length && params.swap.length == params.additionalAmount.length, "DIFFERENT LENGTH");

        for (uint256 i = 0; i < params.orderIds.length; i++) {       
            if(params.swap[i]){
                Order memory order = orders[params.orderIds[i]];
                require(block.timestamp >= order.endTimestamp, "WRONG EXPIRATION TIME");                
                swapsIn[address(order.tokenIn)][address(order.tokenOut)] += order.amountIn;
            }
        }
        uint256 swapsCount;
        for (uint256 i = 0; i < acceptableTokensArray.length; i++) {
            for (uint256 j = 0; j < acceptableTokensArray.length; j++) {
                if(swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]]>0){
                    //console.log("::SWAP");
                    //console.log("::TOKEN IN");
                    //console.log(acceptableTokensArray[i]);
                    //console.log("::TOKEN OUT");
                    //console.log(acceptableTokensArray[j]);
                    //console.log("::AMOUNT IN");
                    //console.log(swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]]);
                    ISwapRouter.ExactInputSingleParams memory swapParams = ISwapRouter
                        .ExactInputSingleParams({
                            tokenIn: acceptableTokensArray[i],
                            tokenOut: acceptableTokensArray[j],
                            fee: poolFee,
                            recipient: address(this),
                            deadline: block.timestamp + swapDeadline,
                            amountIn: swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]],
                            amountOutMinimum: 0, 
                            sqrtPriceLimitX96: 0 
                        });

                    uint256 amountOut = swapRouter.exactInputSingle(swapParams);
                    //console.log("::AMOUNT OUT");
                    //console.log(amountOut);
                    swapsOut[acceptableTokensArray[i]][acceptableTokensArray[j]] = amountOut;
                    //swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]] = 0; //! CHECK IT
                    swapsCount++;// TODO
                }
            }
        }
        // VALIDATE

        for (uint256 i = 0; i < params.orderIds.length; i++) {       
             _executeOrder(params.orderIds[i], params.swap[i],params.additionalAmount[i]);            
        }
    }
    function _executeOrder(uint256 orderId, bool swap, uint256 additionalAmount) private {
            Order storage order = orders[orderId];
            order.additionalAmount = additionalAmount; // ! ADD _aditionAmount Limit check
            order.completed = true;
            //console.log("::orderId", orderId);
            //console.log(":TOKEN OUT ",  address(order.tokenOut));
            if(swap){
                uint256 accuracy = 10 ** order.tokenOut.decimals();
                if(wethAddress == address(order.tokenOut)){
                    accuracy = 1e10;// ! CHECK
                }
                uint256 proportionIn = calculateProportion(swapsIn[address(order.tokenIn)][address(order.tokenOut)], order.amountIn, accuracy);
                //console.log(":TOTAL SWAP OUT",  swapsOut[address(order.tokenIn)][address(order.tokenOut)]);
                //console.log(":TOTAL SWAP IN",  swapsIn[address(order.tokenIn)][address(order.tokenOut)]);
                //console.log(":ORDER amountIn",  order.amountIn);
                //console.log(":PROPORTION IN",  proportionIn);
                
                uint256 swapAmountOut = swapsOut[address(order.tokenIn)][address(order.tokenOut)].div(proportionIn).mul(accuracy);
                uint256 remainder = 0;                
                //console.log("::SWAP AMOUNT OUT", swapAmountOut);
                //console.log("::IS USD", isUsdToken[address(order.tokenIn)]);
                if(isUsdToken[address(order.tokenIn)]){
                    //console.log("::PRICE", order.price);
                    //console.log("::CALC", order.amountIn * 10 ** order.tokenOut.decimals() / order.price );
                    remainder = swapAmountOut - order.amountIn * 10 ** order.tokenOut.decimals() / order.price;                     
                }else{
                    
                    //console.log("::PRICE", order.price);
                    //console.log("::CALC", order.amountIn * order.price / 10 ** order.tokenIn.decimals() );
                    remainder = swapAmountOut - order.amountIn * order.price / 10 ** order.tokenIn.decimals();

                    //console.log("calculatePercentage", swapAmountOut.sub(remainder));
                    //console.log("calculatePercentage", calculatePercentage(swapAmountOut.sub(remainder), maxAdditionalAmountPercentage));
                    //console.log("calculatePercentage", order.additionalAmount);

                    require(order.additionalAmount < calculatePercentage(swapAmountOut.sub(remainder), maxAdditionalAmountPercentage), "WRONG ADDITIONAL AMOUNT");
                }
                console.log("::REMAINDER", remainder);
                order.amountOut = swapAmountOut.sub(remainder);
                balances[order.tokenOut][payerAddress] = balances[order.tokenOut][payerAddress].add(remainder);
            }else{
                order.tokenOut = order.tokenIn;
                order.amountOut = order.amountIn;
            }
            order.completed = true;
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
        return _quantity.mul(_accuracy).div(_total);// ! CHECK 1e10
    }
    function testEncode(ExecuteOrderParams calldata input) public pure returns (bytes memory) {//!DELETE
        return abi.encode(input);
    }

    function claimOrder(
        uint256 _orderId,
        address _usdToken,
        bool _force
    ) public {
        Order storage order = orders[_orderId];
        require(!order.claimed, "ORDER ALREADY CLAIMED" );
        require(order.completed || block.timestamp > order.endTimestamp + maxExecutionTime, "ORDER NOT COMPLETED" );
        if(!_force){
            require(isUsdToken[_usdToken], "IS NOT USD TOKEN" );
            console.log(balances[IERC20(_usdToken)][payerAddress]);
            console.log(payerAddress);
            if(order.additionalAmount > 0 && balances[IERC20(_usdToken)][payerAddress] >= order.additionalAmount){
                _balanceTransfer(IERC20(_usdToken), payerAddress, order.user, order.additionalAmount);
            }
        }else{
            require(msg.sender == order.user, "AVAILABLE ONLY OWNER");
        }
        
        balances[order.tokenOut][order.user] = balances[order.tokenOut][order.user].add(order.amountOut);
        console.log(balances[IERC20(_usdToken)][order.user]);
        order.claimed = true;
        if(msg.sender == order.user){
            _updateUserActionTime();
        }
    }
    function fullWithdrawal(
        IERC20 _tokenAddress,
        uint256 _amount
    ) public {
        require(balances[_tokenAddress][msg.sender] >= _amount, "NOT ENOUGH TOKENS ON THE BALANCE" );
        balances[_tokenAddress][msg.sender] = balances[_tokenAddress][msg.sender].sub(_amount);
        _tokenAddress.transfer(msg.sender, _amount);
    }
    function fullWithdrawalETH(        
        uint256 _amount
    ) public payable {
        require(balances[IERC20(wethAddress)][msg.sender] >= _amount, "NOT ENOUGH WETH TOKENS ON THE BALANCE" );
        //console.log(balances[IERC20(wethAddress)][msg.sender]);
        balances[IERC20(wethAddress)][msg.sender] = balances[IERC20(wethAddress)][msg.sender].sub(_amount);
        //console.log(IWETH9(wethAddress).balanceOf(address(this)));
        IWETH9(wethAddress).withdraw(_amount);
        (bool sent, ) = msg.sender.call{value: _amount}("");
        require(sent, "Failed to send Ether");
    }

    function balanceOf(
        IERC20 _tokenAddress,
        address _user
    ) public view returns (uint256) {
        return balances[_tokenAddress] [_user] ;
    }
    function _balanceTransfer(
        IERC20 _tokenAddress,
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
        IERC20  _tokenAddress,
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