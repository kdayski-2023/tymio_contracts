// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.5 <0.9.0;
pragma abicoder v2;

contract EventTest {
    event NewOrder(uint256 indexed orderId, address indexed user);
    uint256 public count;
    function makeOrder(
        uint256 _orderId
    ) public {
        count++;
        emit NewOrder(_orderId, msg.sender);
    }
}