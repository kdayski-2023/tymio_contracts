// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;
interface IERC20 {
    function balanceOf(address account) external view returns (uint256);

    function transfer(address recipient, uint256 amount)
        external
        returns (bool);

    function approve(address spender, uint256 amount) external returns (bool);
    function deposit() external payable;

    /// @notice Withdraw wrapped ether to get ether
    function withdraw(uint256) external payable;
}

contract WETH9Test {
    IERC20 public WETHToken;
    receive() external payable {}
    function setWeth(address weth) external {
        WETHToken = IERC20(weth);
    }
    function withdraw(uint256 amount) 
        payable 
        external
    {
        WETHToken.withdraw(amount);
    }
}

