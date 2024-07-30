// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

import {INiteToken} from "./interfaces/INiteToken.sol";

import {ERC721Booking} from "./libraries/ERC721Booking.sol";

contract NiteToken is INiteToken, ERC721Booking, Pausable, EIP712 {
    using SignatureChecker for address;

    // keccak256("Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)")
    bytes32 private constant PERMIT_TYPEHASH = 0x49ecf333e5b8c95c40fdafc95c1ad136e8914a8fb55e9dc8bb01eaa83a2df9ad;
    // keccak256("PermitForAll(address owner,address operator,bool approved,uint256 nonce,uint256 deadline)")
    bytes32 private constant PERMIT_FOR_ALL_TYPEHASH =
        0x47ab88482c90e4bb94b82a947ae78fa91fb25de1469ab491f4c15b9a0a2677ee;

    // the nonces mapping is given for replay protection
    mapping(address => uint256) public sigNonces;

    // transfer hook checks are skipped for whitelist
    mapping(address => bool) public whitelist;

    modifier onlyHost() {
        if (_msgSender() != HOST) {
            revert OnlyHost();
        }
        _;
    }

    constructor(
        address _host,
        address _whitelist,
        string memory _name,
        string memory _symbol,
        string memory _uri
    ) ERC721Booking(_host, _name, _symbol) EIP712("DtravelNT", "1") {
        // add host to the whitelist in the default
        whitelist[HOST] = true;

        if (_whitelist != address(0)) {
            whitelist[_whitelist] = true;
            _setApprovalForAll(_host, _whitelist, true);
        }
        baseTokenURI = _uri;

        // pause token transfers by default
        _pause();
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 fromId,
        uint256 lastId
    ) internal override(ERC721Booking) {
        if (whitelist[_msgSender()]) {
            return;
        }

        if (paused()) {
            revert TransferWhilePaused();
        }

        super._beforeTokenTransfer(from, to, fromId, lastId);
    }

    /**
     * @notice Set up a whitelist
     * @dev Caller must be HOST
     * @param _addr The given address
     * @param _isWhitelist The whitelist status
     */
    function setWhitelist(address _addr, bool _isWhitelist) external onlyHost {
        whitelist[_addr] = _isWhitelist;
        emit SetWhitelist(_addr, _isWhitelist);
    }

    /**
     * @notice Set token name
     * @dev    Caller must be HOST
     * @param _name token name
     */
    function setName(string calldata _name) external onlyHost {
        name = _name;
    }

    /**
     * @notice Set token base URI
     * @dev    Caller must be HOST
     * @param _uri token base URI
     */
    function setBaseURI(string calldata _uri) external onlyHost {
        baseTokenURI = _uri;
    }

    /**
     * @notice Disable token transfer
     * @dev Caller must be HOST
     */
    function pause() external onlyHost {
        _pause();
    }

    /**
     * @notice Enable token transfer
     * @dev Caller must be HOST
     */
    function unpause() external onlyHost {
        _unpause();
    }

    /**
     * @notice ERC721 Permit extension allowing approvals to be made via signatures.
     *      The nonce is incremented upon every permit execution, not allowing multiple permits to be executed
     * @dev Caller can be ANYONE
     * @param _spender The account that is being approved
     * @param _tokenId The token ID that is being approved for spending
     * @param _deadline The deadline timestamp by which the call must be mined for the approve to work
     * @param _signature The signature provided by token owner
     */
    function permit(address _spender, uint256 _tokenId, uint256 _deadline, bytes calldata _signature) public {
        address owner = ownerOf(_tokenId);
        if (owner == _spender) {
            revert ApprovalToCurrentOwner();
        }

        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, _spender, _tokenId, sigNonces[owner]++, _deadline));

        bytes32 digest = _hashTypedDataV4(structHash);

        _validateRecoveredAddress(digest, owner, _deadline, _signature);
        _approve(_spender, _tokenId);
    }

    /**
     * @notice ERC721 Permit extension allowing all token approvals to be made via signatures.
     *      The nonce is incremented upon every permit execution, not allowing multiple permits to be executed
     * @dev Caller can be ANYONE
     * @param _owner The token owner
     * @param _operator The account that is being approved
     * @param _approved The approval status
     * @param _deadline The deadline timestamp by which the call must be mined for the approve to work
     * @param _signature The signature provided by token owner
     */
    function permitForAll(
        address _owner,
        address _operator,
        bool _approved,
        uint256 _deadline,
        bytes calldata _signature
    ) public {
        if (_operator == address(0)) {
            revert ZeroAddress();
        }

        bytes32 structHash = keccak256(
            abi.encode(PERMIT_FOR_ALL_TYPEHASH, _owner, _operator, _approved, sigNonces[_owner]++, _deadline)
        );

        bytes32 digest = _hashTypedDataV4(structHash);

        _validateRecoveredAddress(digest, _owner, _deadline, _signature);
        _setApprovalForAll(_owner, _operator, _approved);
    }

    /**
     * @notice Transfer token, using permit for approvals
     * @dev Caller must be SPENDER
     * @param _tokenId The token ID that is being approved for spending
     * @param _deadline The deadline timestamp by which the call must be mined for the approve to work
     * @param _signature The signature provided by token owner
     */
    function transferWithPermit(address _to, uint256 _tokenId, uint256 _deadline, bytes calldata _signature) external {
        permit(_msgSender(), _tokenId, _deadline, _signature);
        transferFrom(ownerOf(_tokenId), _to, _tokenId);
    }

    function _validateRecoveredAddress(
        bytes32 _digest,
        address _owner,
        uint256 _deadline,
        bytes calldata _signature
    ) private view {
        if (block.timestamp > _deadline) {
            revert PermitExpired();
        }

        if (!_owner.isValidSignatureNow(_digest, _signature)) {
            revert InvalidPermitSignature();
        }
    }
}
