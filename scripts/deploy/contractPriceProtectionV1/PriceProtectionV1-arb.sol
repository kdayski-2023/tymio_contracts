// SPDX-License-Identifier: BUSL-1.1

pragma solidity =0.8.20;
pragma abicoder v2;
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./lib/ArrayUtils.sol";
import {Errors} from "./lib/ErrorsPriceProtection.sol";

contract PriceProtectionV1 {
    using SafeERC20 for IERC20;
    using ArrayUtils for address[];

    address public owner1;
    address public owner2;
    address public service;

    struct Order {
        address user;
        address token;
        uint256 amount;
        uint256 additionalAmount;
        uint256 executionTimestamp;
        bool completed;
        bool claimed;
    }

    struct ExecuteOrderParams {
        uint256[] orderIds;
        bool[] exec;
        uint256[] additionalAmount;
    }

    constructor() {
        owner1 = msg.sender;
        payerAddress = owner1;
    }

    receive() external payable {}

    modifier onlyOwners() {
        if (msg.sender != owner1 && msg.sender != owner2) {
            revert Errors.NotAllowedAddress();
        }
        _;
    }

    modifier onlyOwnerOrService() {
        if (msg.sender != owner1 && msg.sender != owner2 && msg.sender != service) {
            revert Errors.NotAllowedAddress();
        }
        _;
    }

    uint256 public acceptableTokensArrayLength;
    mapping(address => mapping(address => uint256)) public balances;
    mapping(address => uint256) public lastUserActionTime;
    Order[] public orders;
    mapping(address => bool) public acceptableTokens;
    mapping(address => uint256) public minimalTokenAmounts;
    address[] public acceptableTokensArray;
    address public payerAddress;
    uint public constant maxDuration = 90 days;
    uint public constant maxExecutionTime = 1 hours;
    uint public constant fullAccessAfter = 365 days;

    event Deposit(address indexed user, address indexed token, uint256 amount);
    event NewOrder(uint256 indexed orderId, address indexed user, address indexed token, uint256 amount, uint256 executionTimestamp);
    event ClaimOrder(uint256 indexed orderId);
    event FullWithdrawal(address indexed user, address indexed token, uint256 amount);
    event UpdateBalance(address indexed user, address indexed token, uint256 amount);

    /**
     * @dev Allows deposit of USD tokens and order creation in a single transaction.
     */
    function depositAndOrder(
        address _tokenAddress,
        uint256 _amountDeposit,
        uint256 _amountOrder,
        uint256 _executionTimestamp
    ) public {
        deposit(_tokenAddress, _amountDeposit);
        makeOrder(_tokenAddress, _amountOrder, _executionTimestamp);
    }

    /**
     * @dev Creates a new order with the specified parameters.
     */
    function makeOrder(
        address _tokenAddress,
        uint256 _amount,
        uint256 _executionTimestamp
    ) public {

        if (!(balances[_tokenAddress][msg.sender] >= _amount)) {
            revert Errors.NoTokenBalance();
        }
        if (!(_executionTimestamp > block.timestamp)) {
            revert Errors.InvalidExecutionTime();
        }
        if (!(_executionTimestamp <= block.timestamp + maxDuration)) {
            revert Errors.DurationMoreMaximum();
        }
        if (!(_amount >= minimalTokenAmounts[_tokenAddress])) {
            revert Errors.WrongAmount();
        }
        
        balances[_tokenAddress][msg.sender] = balances[_tokenAddress][msg.sender] - _amount;
        
        orders.push(
            Order(
                msg.sender,
                _tokenAddress,
                _amount,
                0,
                _executionTimestamp,
                false,
                false
            )
        );
        _updateUserActionTime();
        emit UpdateBalance(
            msg.sender,
            _tokenAddress,
            balances[_tokenAddress][msg.sender]
        );
        emit NewOrder(
            orders.length - 1,
            msg.sender,
            _tokenAddress,
            _amount,
            _executionTimestamp
        );
    }

    /**
     * @dev Allows deposit of ERC20 tokens.
     */
    function deposit(address _tokenAddress, uint256 _amount) public payable {
        if (!acceptableTokens[_tokenAddress]) {
            revert Errors.NotAllowedToken();
        }
        if (_amount == 0) {
            revert Errors.NotAllowedZero();
        }
        IERC20(_tokenAddress).safeTransferFrom(msg.sender, address(this), _amount);
        balances[_tokenAddress][msg.sender] = balances[_tokenAddress][msg.sender] + _amount;
        _updateUserActionTime();
        emit UpdateBalance(
            msg.sender,
            _tokenAddress,
            balances[_tokenAddress][msg.sender]
        );
        emit Deposit(msg.sender, _tokenAddress, _amount);
    }


    /**
     * @dev Allows batch execution of orders based on the provided parameters.
     */
    function executeOrders(ExecuteOrderParams calldata _params) public onlyOwnerOrService {
        uint256 orderIdsLength = _params.orderIds.length;
        if (!(orderIdsLength == _params.additionalAmount.length && orderIdsLength == _params.exec.length)) {
            revert Errors.DifferentLength();
        }
        
        for (uint256 i; i < orderIdsLength; ) {
            Order storage order = orders[_params.orderIds[i]];
            if (!(block.timestamp >= order.executionTimestamp)) {
                revert Errors.WrongExecutionTime();
            }
            if (order.claimed) {
                revert Errors.OrderAlreadyClaimed();
            }
            if (order.completed) {
                revert Errors.OrderAlreadyCompleted();
            }
            
            _executeOrder(_params.orderIds[i], _params.additionalAmount[i], _params.exec[i]);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @dev Internal function to execute a single order.
     */
    function _executeOrder(uint256 orderId, uint256 additionalAmount, bool exec) private {
        Order storage order = orders[orderId];
        order.completed = true;
        balances[order.token][payerAddress] = balances[order.token][payerAddress] + order.amount;
        if (exec) {
            order.additionalAmount = additionalAmount;            
        } else{
            order.claimed = true;            
            emit UpdateBalance(
                payerAddress,
                order.token,
                balances[order.token][payerAddress]
            );
        }
    }

    /**
     * @dev Allows claiming of completed orders.
     */
    function claimOrder(
        uint256 _orderId,
        bool _force
    ) public {
        Order storage order = orders[_orderId];
        if (order.claimed) {
            revert Errors.OrderAlreadyClaimed();
        }
        if (!(order.completed || block.timestamp > order.executionTimestamp + maxExecutionTime)) {
            revert Errors.OrderNotCompleted();
        }
        if (!_force) {
            if (balances[order.token][payerAddress] < order.additionalAmount) {
                revert Errors.InsufficientPayerBalance();
            }
            _balanceTransfer(order.token, payerAddress, order.user, order.additionalAmount);
        } else {
            if (msg.sender != order.user) {
                revert Errors.AvailableOnlyOwner();
            }
        }        
        order.claimed = true;
        if (msg.sender == order.user) {
            _updateUserActionTime();            
        }
        emit UpdateBalance(
                order.user,
                order.token,
                balances[order.token][order.user]
            );
        emit ClaimOrder(_orderId);
    }

    /**
     * @dev Allows full withdrawal of ERC20 tokens.
     */
    function fullWithdrawal(address _tokenAddress, uint256 _amount) public {
        if (balances[_tokenAddress][msg.sender] < _amount) {
            revert Errors.NoTokenBalance();
        }
        balances[_tokenAddress][msg.sender] = balances[_tokenAddress][msg.sender] - _amount;
        IERC20(_tokenAddress).safeTransfer(msg.sender, _amount);
        _updateUserActionTime();
        emit FullWithdrawal(msg.sender, _tokenAddress, _amount);
    }

    /**
     * @dev Returns the balance of a specific token for a user.
     */
    function balanceOf(
        address _tokenAddress,
        address _user
    ) public view returns (uint256) {
        return balances[_tokenAddress][_user];
    }

    /**
     * @dev Internal function to transfer balance between addresses.
     */
    function _balanceTransfer(
        address _tokenAddress,
        address _sender,
        address _recipient,
        uint256 _amount
    ) internal {
        balances[_tokenAddress][_sender] = balances[_tokenAddress][_sender] - _amount;
        balances[_tokenAddress][_recipient] = balances[_tokenAddress][_recipient] + _amount;
    }

    /**
     * @dev Updates the last action time for a user.
     */
    function _updateUserActionTime() internal {
        lastUserActionTime[msg.sender] = block.timestamp;
    }

    /**
     * @dev Allows editing of acceptable tokens.
     */
    function editAcceptableToken(
        address _token,
        bool _value,
        uint256 _minimalAmount
    ) public onlyOwners {
        if (_value) {
            if (acceptableTokens[_token]) {
                revert Errors.DuplicateToken();
            }
            if (_minimalAmount == 0) {
                revert Errors.NotAllowedZero();
            }
            acceptableTokensArray.push(_token);
            minimalTokenAmounts[_token] = _minimalAmount;
        } else {
            acceptableTokensArray.deleteItem(_token);
        }
        acceptableTokens[_token] = _value;
        acceptableTokensArrayLength = acceptableTokensArray.length;
    }

    /**
     * @dev Returns the ETH balance of the contract.
     */
    function getEthBalance() public view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Allows owners to withdraw ETH from the contract.
     */
    function getBackEth(
        address payable _to,
        uint256 _amount
    ) external payable onlyOwners {
        (bool sent, ) = _to.call{value: _amount}("");
        if (!sent) {
            revert Errors.FailedToSendEther();
        }
    }

    /**
     * @dev Allows emergency withdrawal of funds.
     */
    function emergencyQuit(
        address _user,
        address _tokenAddress,
        uint256 _amount
    ) external onlyOwners {
        if (!(block.timestamp > lastUserActionTime[_user] + fullAccessAfter)) {
            revert Errors.WrongTimestamp();
        }
        _balanceTransfer(_tokenAddress, _user, payerAddress, _amount);
    }

    /**
     * @dev Returns the balance of a specific token in the contract.
     */
    function getTokenBalance(IERC20 token) public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @dev Sets the service address.
     */
    function setServiceAddress(address _address) external onlyOwners {
        service = _address;
    }

    /**
     * @dev Sets the first owner address.
     */
    function setOwner1Address(address _address) external onlyOwners {
        owner1 = _address;
    }

    /**
     * @dev Sets the second owner address.
     */
    function setOwner2Address(address _address) external onlyOwners {
        owner2 = _address;
    }

    /**
     * @dev Sets the payer address.
     */
    function setPayerAddress() external onlyOwners {
        payerAddress = msg.sender;
    }

}