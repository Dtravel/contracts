// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

interface IFactory {
    function gasToken() external returns (address);
    function treasury() external returns (address);
    function feeAmountPerTransfer() external returns (uint256);
    function niteContract(address, uint256) external returns (address);
    function setOperator(address _addr) external;
    function setTreasury(address _addr) external;
    function setFeeAmountPerTransfer(uint256 _feeAmount) external;
    function createNiteContract(
        uint256 _slot,
        address _host,
        string calldata _name,
        string calldata _uri
    ) external returns (address _nft);

    event NewOperator(address indexed newOperator);
    event NewTreasury(address indexed newTreasury);
    event NewFeeAmountPerTransfer(uint256 feeNumerator);
    event NewNiteContract(uint256 indexed slot, address indexed niteContract, address indexed host);

    error ZeroAddress();
    error TokenDeployedAlready();
}
