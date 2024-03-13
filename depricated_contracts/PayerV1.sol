// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

// import "hardhat/console.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);

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

contract PayerV1 {
    address public owner1;
    address public owner2;
    address public service;
    IERC20 public usdc;

    constructor(IERC20 _usdc) payable {
        owner1 = msg.sender;
        usdc = _usdc;
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
    address[] public ethAddress;
    uint256[] public ethValue;
    address[] public usdAddress;
    uint256[] public usdValue;
    uint256 public ethAddressCount = 0;
    uint256 public usdAddressCount = 0;
    bool public paid;
    bool public recorded;

    function create(
        address[] calldata _ethAddress,
        uint256[] calldata _ethValue,
        address[] calldata _usdAddress,
        uint256[] calldata _usdValue
    ) public onlyOwnerOrService {
        require(recorded == false, "ALREADY RECORDED");
        ethAddressCount = _ethAddress.length;
        usdAddressCount = _usdAddress.length;
        ethAddress = _ethAddress;
        ethValue = _ethValue;
        usdAddress = _usdAddress;
        usdValue = _usdValue;
        paid = false;
        recorded = true;
    }

    function makePayment() public onlyOwners {
        require(paid == false, "ALREADY PAID");
        for (uint256 i = 0; i < ethAddress.length; i++) {
            (bool sent, ) = payable(ethAddress[i]).call{value: ethValue[i]}("");
            require(sent, "Failed to send Ether");
        }
        for (uint256 i = 0; i < usdAddress.length; i++) {
            usdc.transfer(usdAddress[i], usdValue[i]);
        }
        paid = true;
        recorded = false;
    }

    function resetRecorded() external onlyOwners {
        recorded = false;
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

    function setUsdAddress(IERC20 _address) external onlyOwners {
        usdc = _address;
    }

    // ONLY FOR DEVELOP
    function getEthBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function getUsdBalance() public view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function getPayoutAmount() public view returns (uint256, uint256) {
        uint256 valueEth = 0;
        uint256 valueUsd = 0;
        for (uint256 i = 0; i < ethAddress.length; i++) {
            valueEth += ethValue[i];
        }
        for (uint256 i = 0; i < usdAddress.length; i++) {
            valueUsd += usdValue[i];
        }
        return (valueEth, valueUsd);
    }

    function isEnoughPayoutAmount() public view returns (bool isEnough) {
        (uint256 valueEth, uint256 valueUsd) = getPayoutAmount();
        if (getEthBalance() >= valueEth && getUsdBalance() >= valueUsd)
            return true;
        return false;
    }

    function getPayReport()
        public
        view
        returns (address[] memory, uint256[] memory, bool[] memory)
    {
        uint256 ethCount = ethAddress.length;
        uint256 usdCount = usdAddress.length;
        address[] memory user = new address[](ethCount + usdCount);
        uint256[] memory value = new uint256[](ethCount + usdCount);
        bool[] memory isUsd = new bool[](ethCount + usdCount);
        uint256 c = 0;
        for (uint256 i = 0; i < ethCount; i++) {
            user[c] = ethAddress[i];
            value[c] = ethValue[i];
            isUsd[c] = false;
            c++;
        }
        for (uint256 i = 0; i < usdCount; i++) {
            user[c] = usdAddress[i];
            value[c] = usdValue[i];
            isUsd[c] = true;
            c++;
        }
        return (user, value, isUsd);
    }
}
