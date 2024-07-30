// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

interface IPayment {
    struct Payment {
        address token;
        address receiver;
        uint256 amount;
    }

    function setTreasury(address _addr) external;
    function setFee(uint256 _feeNumerator) external;
    function makePayment(uint256 paymentId, Payment[] calldata payments) external payable;

    event NewTreasury(address indexed newTreasury);
    event NewFeeNumerator(uint256 feeNumerator);
    event MakePayment(uint256 indexed paymentId, address indexed payer, Payment[] indexed payments);

    error ZeroAddress();
    error EmptyPaymentList();
    error TransferFailed();
}
