// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";

import {IFactory} from "./interfaces/IFactory.sol";

import {NiteToken} from "./NiteToken.sol";

contract Factory is IFactory, Ownable {
    bytes32 public constant VERSION = keccak256("BOOKING_V4");

    address private immutable GAS_TOKEN;

    // the treasury address to receive gas fee from Nite transfers
    address public treasury;

    // the gas fee per Nite transfer, sent to the treasury
    uint256 public feeAmountPerTransfer;

    // returns Nite contract address for a slot given by host (host => slot => nite contract)
    mapping(address => mapping(uint256 => address)) public niteContract;

    // the operator address that could be approved by host to transfer Nite tokens
    address public operator;

    constructor(address _operator, address _treasury, address _tokenAddress, uint256 _feeAmount) Ownable(msg.sender) {
        if (_operator == address(0) || _treasury == address(0) || _tokenAddress == address(0)) {
            revert ZeroAddress();
        }
        operator = _operator;
        treasury = _treasury;
        GAS_TOKEN = _tokenAddress;
        feeAmountPerTransfer = _feeAmount;
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
     * @notice Set treasury address
     * @dev    Caller must be CONTRACT OWNER
     * @param _addr The new treasury address
     */
    function setTreasury(address _addr) external onlyOwner {
        if (_addr == address(0)) {
            revert ZeroAddress();
        }
        treasury = _addr;
        emit NewTreasury(_addr);
    }

    /**
     * @notice Set TRVL gas fee amount per Nite token transfer
     * @dev    Caller must be CONTRACT OWNER
     * @param _feeAmount the fee amount
     */
    function setFeeAmountPerTransfer(uint256 _feeAmount) external onlyOwner {
        feeAmountPerTransfer = _feeAmount;
        emit NewFeeAmountPerTransfer(_feeAmount);
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
            abi.encode(_host, operator, address(this), _name, "NT", _uri)
        );

        _niteContract = Create2.deploy(0, salt, bytecode);
        niteContract[_host][_slot] = _niteContract;

        emit NewNiteContract(_slot, _niteContract, _host);
    }

    function gasToken() external view returns (address) {
        return GAS_TOKEN;
    }
}
