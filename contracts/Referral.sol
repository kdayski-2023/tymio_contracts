// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.5 <0.9.0;
pragma abicoder v2;

library SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "SafeMath: subtraction overflow");
        uint256 c = a - b;

        return c;
    }
}
interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(
        address recipient,
        uint256 amount
    ) external returns (bool);
}
contract Referral {
    using SafeMath for uint256;
    address public owner1;
    address public owner2;
    address public service;
    IERC20 public usdc;
    constructor() {
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
    mapping(address => uint256) private balances;
    event Withdraw(address indexed user, uint256 amount);
    function withdraw(
        uint256 _amount
    ) public {
        require(usdc.balanceOf(address(this)) >= _amount , "NO FUNDS IN THE VAULT" );
        require(balanceOf(msg.sender) >= _amount , "INCORRECT AMOUNT" );
        balances [msg.sender] = balances [msg.sender].sub(_amount);
        usdc.transfer(msg.sender,_amount);
        emit  Withdraw(msg.sender, _amount);
    }    
    function setBalances(
        address[] calldata _userAddress,
        uint256[] calldata _amount
    ) public onlyOwnerOrService {
        require(_amount.length == _userAddress.length, "SAME LENGTH");
        uint256 recordCount = _userAddress.length;
        for (uint256 i = 0; i < recordCount; i++) {
            balances[_userAddress[i]] = _amount[i];
        }
    }
    function addBalances(
        address[] calldata _userAddress,
        uint256[] calldata _amount
    ) public onlyOwnerOrService {
        require(_amount.length == _userAddress.length, "SAME LENGTH");
        uint256 recordCount = _userAddress.length;
        for (uint256 i = 0; i < recordCount; i++) {
            balances[_userAddress[i]] = balances[_userAddress[i]].add(_amount[i]);
        }
    }
    function balanceOf(
        address _user
    ) public view returns (uint256) {
        return balances [_user] ;
    }
    function getEthBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function getTokenBalance(IERC20 token) public view returns (uint256) {
        return token.balanceOf(address(this));
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
    function setUsdc(address _address) external onlyOwners {
        usdc = IERC20(_address);
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
}