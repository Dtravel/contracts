// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";

import {IFactory} from "./interfaces/IFactory.sol";

import {NiteToken} from "./NiteToken.sol";

contract Factory is IFactory, Ownable {
    bytes32 public constant VERSION = keccak256("BOOKING_V4");

    // returns Nite contract address for a slot given by host (host => slot => nite contract)
    mapping(address => mapping(uint256 => address)) public niteContract;

    // the operator address that could be approved by host to transfer Nite tokens
    address public operator;

    constructor(address _operator) Ownable(msg.sender) {
        operator = _operator;
    }

    /**
     * @notice Set operator address
     * @dev    Caller must be CONTRACT OWNER
     * @param _addr The new operator address
     */
    function setOperator(address _addr) external onlyOwner {
        operator = _addr;

        emit NewOperator(_addr);
    }

    /**
     * @notice Create a new Room Night Token contract for host
     * @dev    Caller can be ANYONE
     * @param _slot The unique slot number
     * @param _host The host address
     * @param _name The token name
     * @param _uri The token URI
     */
    function createNiteContract(
        uint256 _slot,
        address _host,
        string calldata _name,
        string calldata _uri
    ) external returns (address _niteContract) {
        if (niteContract[_host][_slot] != address(0)) {
            revert TokenDeployedAlready();
        }

        bytes32 salt = keccak256(abi.encodePacked(_host, _slot, VERSION));

        bytes memory bytecode = abi.encodePacked(
            type(NiteToken).creationCode,
            abi.encode(_host, operator, _name, "NT", _uri)
        );

        _niteContract = Create2.deploy(0, salt, bytecode);
        niteContract[_host][_slot] = _niteContract;

        emit NewNiteContract(_slot, _niteContract, _host);
    }
}
