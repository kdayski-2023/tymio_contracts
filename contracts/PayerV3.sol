// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.5 <0.9.0;
pragma abicoder v2;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./lib/ArrayUtils.sol";
import "hardhat/console.sol";
library SafeMath {
    /**
     * @dev Returns the addition of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     * - Addition cannot overflow.
     */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "SafeMath: subtraction overflow");
        uint256 c = a - b;

        return c;
    }

    /**
     * @dev Returns the multiplication of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `*` operator.
     *
     * Requirements:
     * - Multiplication cannot overflow.
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-solidity/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        // Solidity only automatically asserts when dividing by 0
        require(b > 0, "SafeMath: division by zero");
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b != 0, "SafeMath: modulo by zero");
        return a % b;
    }
}
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
        bool withdrawn;
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
        payerAddress = owner1;// !DEV
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
    uint24 poolFee = 500; // ! need setter
    uint256 maxAdditionalAmountPercentage  = 200; // !2% need setter
    uint256 approximateEthPrice = 2500000000; // need setter
    uint256 swapDeadline  = 10 minutes;
    mapping(IERC20 => mapping(address => uint256)) public balances;
    mapping(address => mapping(address => uint256)) public swapsIn;
    mapping(address => mapping(address => uint256)) public swapsOut;
    mapping(address => uint256) public lastUserActionTime;
    Order[] public orders;
    mapping(address => bool) public acceptableTokens; 
    address[] public acceptableTokensArray;
    address public wethAddress;
    IERC20 public usdToken;
    uint maxDuration = 90 days;
    uint maxExecutionTime = 1 seconds;//! IN PROD SET 1 hours
    uint fullAccessAfter = 360 days;//! IN PROD CHECK
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
        require(address(_tokenAddressIn) == wethAddress,"NOT WETH");
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
    function executeOrders(ExecuteOrderParams calldata params) public onlyOwners {//!, uint256[] calldata validateAmounts
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
                    console.log("::SWAP");
                    console.log("::TOKEN IN");
                    console.log(acceptableTokensArray[i]);
                    console.log("::TOKEN OUT");
                    console.log(acceptableTokensArray[j]);
                    console.log("::AMOUNT IN");
                    console.log(swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]]);
                    ISwapRouter.ExactInputSingleParams memory swapParams = ISwapRouter
                        .ExactInputSingleParams({
                            tokenIn: acceptableTokensArray[i],
                            tokenOut: acceptableTokensArray[j],
                            fee: poolFee,
                            recipient: address(this),
                            deadline: block.timestamp + swapDeadline,
                            amountIn: swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]],
                            amountOutMinimum: 0, // ! DANGER
                            sqrtPriceLimitX96: 0 // ! DANGER
                        });

                    uint256 amountOut = swapRouter.exactInputSingle(swapParams);
                    console.log("::AMOUNT OUT");
                    console.log(amountOut);
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
            if(swap){
                //uint256 percentageIn = calculatePercentage(swapsOut[]);
                uint256 proportionIn = calculateProportion(swapsIn[address(order.tokenIn)][address(order.tokenOut)], order.amountIn);
                
                console.log("::proportionIn");
                console.log(swapsOut[address(order.tokenIn)][address(order.tokenOut)]);
                console.log(swapsIn[address(order.tokenIn)][address(order.tokenOut)]);
                console.log(order.amountIn);
                console.log(proportionIn);

                order.amountOut = swapsOut[address(order.tokenIn)][address(order.tokenOut)].div(proportionIn).mul(1e10);
            }else{
                order.tokenOut = order.tokenIn;
                order.amountOut = order.amountIn;
            }
    }
    function calculatePercentage(
        uint256 _quantity,
        uint256 _percentage
    ) public pure returns (uint256) {
        return _quantity.mul(_percentage).div(1000);
    }
     function calculateProportion(
        uint256 _quantity,
        uint256 _total
    ) public pure returns (uint256) {
        return _quantity.mul(1e10).div(_total);
    }
    function testEncode(ExecuteOrderParams calldata input) public pure returns (bytes memory) {//!DELETE
        return abi.encode(input);
    }

    function claimOrder(
        uint256 _orderId
    ) public {
        Order storage order = orders[_orderId];
        require(!order.withdrawn, "ORDER ALREADY WITHDRAWN" );
        require(block.timestamp > order.endTimestamp + maxExecutionTime, "ORDER NOT COMPLETED" );
        if(order.additionalAmount > 0 ){
            _balanceTransfer(usdToken, payerAddress, order.user, order.additionalAmount);
        }
        balances[order.tokenOut][order.user] = balances[order.tokenOut][order.user].add(order.amountOut);
        
        order.withdrawn = true;
        if(msg.sender == order.user){
            _updateUserActionTime();
        }
    }
    function fullWithdrawal(
        IERC20 _tokenAddress,
        uint256 _amount
    ) public {
        balances[_tokenAddress][msg.sender] = balances[_tokenAddress][msg.sender].sub(_amount);
        _tokenAddress.transfer(msg.sender, _amount);
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
        //require(_sender != address(0), "ERC20: transfer from the zero address");
        //require(_recipient != address(0), "ERC20: transfer to the zero address");

        balances[_tokenAddress][_sender] = balances[_tokenAddress][_sender].sub(_amount);
        balances[_tokenAddress][_recipient] = balances[_tokenAddress][_recipient].add(_amount);
    }
    function _updateUserActionTime() internal {
        lastUserActionTime[msg.sender] = block.timestamp;
    }
    function editAcceptableToken(address _token, bool _value) public onlyOwners {
        acceptableTokens[_token] = _value;
        if(_value){
            acceptableTokensArray.push(_token);
        }else{
            acceptableTokensArray.deleteItem(_token);
        }
    }

    function getAllUserOrders(address _user) public view returns (Order[] memory) {// !DEBUG ONLY
        uint256 count = 0;
        for (uint256 i = 0; i < orders.length; i++) {            
            if(orders[i].user == _user) count++;
        }
        Order[] memory userOrders = new Order[](count);
        count = 0;
        for (uint256 i = 0; i < orders.length; i++) {  
            if(orders[i].user == _user) userOrders[count++]= orders[i];
        }
        return userOrders;
    }
    function checkZeroBalance() public pure returns (uint256) {// !DEBUG ONLY
        uint256 count = 0;
        return 0;
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
    function setUsdToken(IERC20 _usdToken) external onlyOwners {
        usdToken = _usdToken;
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
    
}