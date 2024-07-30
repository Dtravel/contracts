// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

interface IFactory {
    function niteContract(address, uint256) external returns (address);
    function setOperator(address _addr) external;
    function createNiteContract(
        uint256 _slot,
        address _host,
        string calldata _name,
        string calldata _uri
    ) external returns (address _nft);

    event NewOperator(address indexed newOperator);
    event NewNiteContract(uint256 indexed slot, address indexed niteContract, address indexed host);

    error TokenDeployedAlready();
}
