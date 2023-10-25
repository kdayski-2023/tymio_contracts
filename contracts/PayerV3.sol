// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.5 <0.9.0;
pragma abicoder v2;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./lib/ArrayUtils.sol";

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
    
    struct Order {
        address user;
        address tokenIn;
        uint256 amountIn;
        address tokenOut;
        uint256 amountOut;
        uint256 aditionAmount;
        uint256 endTimestamp;
        bool completed;
        bool withdrawn;
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
    ISwapRouter public swapRouter = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);

    mapping(IERC20 => mapping(address => uint256)) public balances;
    Order[] public orders;
    mapping(address => bool) public acceptableTokens; 
    address[] public acceptableTokensArray;
    address public weth;
    uint maxDuration = 90 days;
    uint maxExecutionTime = 1 hours;
    event Deposit(address indexed user,address indexed token, uint256 amount);
    event NewOrder(uint256 indexed orderId, address indexed user, address indexed token, uint256 amount, uint256 duration);
    address public payerAddress;
    function depositAndOrder(
        IERC20 _tokenAddress,
        uint256 _amount,
        uint256 _duration
    )public{
        deposit(_tokenAddress, _amount);
        makeOrder(_tokenAddress, _amount, _duration);
    }
    function makeOrder(
        IERC20 _tokenAddress,
        uint256 _amount,
        uint256 _duration
    ) public {
        require(balances[_tokenAddress] [msg.sender]>=_amount, "NO BALANCE");
        orders.push(Order(msg.sender, address(_tokenAddress), _amount, address(0), 0, block.timestamp + _duration, false , false ));
        emit NewOrder(orders.length - 1, msg.sender, address(_tokenAddress),_amount, _duration);
    }
    function deposit(
        IERC20 _tokenAddress,
        uint256 _amount
    ) public payable {
        require(acceptableTokens[ address(_tokenAddress)], "NOT ALLOWED TOKEN");
        if(address(_tokenAddress) == weth && msg.value > 0){
            require(_amount == msg.value, "AMOUNTS NOT MATCH");
            IWETH9(weth).deposit{ value: msg.value }();
        }else{
            require(_tokenAddress.transferFrom(msg.sender, address(this), _amount), "TRANSFER FROM ERROR");
        }
        balances[_tokenAddress] [msg.sender] = balances[_tokenAddress] [msg.sender] + _amount;
        emit Deposit(msg.sender, address(_tokenAddress),_amount);
    }
    function depositEth() public payable {
        IWETH9(weth).deposit{ value: msg.value }();
        balances[IERC20(weth)] [msg.sender] = balances[IERC20(weth)] [msg.sender].add(msg.value) ;
        emit Deposit(msg.sender, weth, msg.value);
    }
    function executeOrder(        
        uint256 _orderId,
        bool _needSwap,
        uint256 _aditionAmount
    ) public onlyOwners {
        Order storage order = orders[_orderId];
        order.tokenOut = order.tokenIn; // ! TODO
        order.aditionAmount = _aditionAmount; // ! ADD _aditionAmount Limit check
        order.completed = true;
        if(_needSwap){
            //debugSwap()
        }
    }
    function withdrawalOrder(
        uint256 _orderId
    ) public {
        Order storage order = orders[_orderId];
        require(!order.withdrawn, "ORDER ALREADY WITHDRAWN" );
        require(order.completed || block.timestamp > order.endTimestamp + maxExecutionTime, "ORDER NOT COMPLETED" );
        if(order.aditionAmount > 0 ){
            _transfer(IERC20(order.tokenOut), payerAddress, order.user, order.aditionAmount);
        }
        balances[IERC20(order.tokenOut)][order.user].add(order.amountOut);
        order.withdrawn = true;

    }
    function fullWithdrawal(
        IERC20 _tokenAddress,
        uint256 _amount
    ) public {
        balances[_tokenAddress][msg.sender].sub(_amount);
        _tokenAddress.transfer(msg.sender, _amount);
    }
    function balanceOf(
        IERC20 _tokenAddress,
        address _user
    ) public view returns (uint256) {
        return balances[_tokenAddress] [_user] ;
    }
    function _transfer(
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
    function editAcceptableToken(address _token, bool _value) public onlyOwners {
        acceptableTokens[_token] = _value;
        if(_value){
            acceptableTokensArray.push(_token);
        }else{
            acceptableTokensArray.deleteItem(_token);
        }
    }
    function debugSwap(address _user, IERC20 _tokenFrom, uint256 _amountFrom, IERC20 _tokenTo, uint256 _amountTo) public {
        balances[_tokenFrom] [_user] = _amountFrom;
        balances[_tokenTo] [_user] = _amountTo;
    }
    function swapExactInputSingle(address _from, address _to, uint256 _amountIn, uint24 _poolFee, bool _deposit, bool _withdraw)
        external onlyOwners
    {
        require(acceptableTokens[_from] && acceptableTokens[_to], "NOT ALLOWED TOKEN");
        if(_deposit){
            IWETH9(_from).deposit{ value: _amountIn }();
        }
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
        if(_withdraw){
            IWETH9(_to).withdraw(_amountIn);
        }
    }
    function swapExactOutputSingle(address _from, address _to, uint _amountOut, uint _amountInMaximum, uint24 _poolFee, bool _deposit, bool _withdraw) external onlyOwners {
        require(acceptableTokens[_from] && acceptableTokens[_to], "NOT ALLOWED TOKEN");
        if(_deposit){
            IWETH9(_from).deposit{ value: _amountInMaximum }();
        }
        IERC20(_from).approve(address(swapRouter), _amountInMaximum);
        ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter.ExactOutputSingleParams({
                tokenIn: _from,
                tokenOut: _to,
                fee: _poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountOut: _amountOut,
                amountInMaximum: _amountInMaximum,
                sqrtPriceLimitX96: 0
            });
        uint256 amountIn = swapRouter.exactOutputSingle(params);
        if (amountIn < _amountInMaximum) {
             IERC20(_from).approve(address(swapRouter), 0);
        }
        if(_withdraw){
            IWETH9(_to).withdraw(amountIn);
        }
    }
    function getAllUserOrders(address _user) public view returns (Order[] memory) {
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
    function getEthBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function getTokenBalance(IERC20 token) public view returns (uint256) {
        return token.balanceOf(address(this));
    }
    function setSwapRouter(address _router) external onlyOwners {
        swapRouter = ISwapRouter(_router);
    }
    function setWeth(address _weth) external onlyOwners {
        weth = _weth;
    }
}