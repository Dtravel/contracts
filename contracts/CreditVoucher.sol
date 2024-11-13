// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {ICreditVoucher} from "./interfaces/ICreditVoucher.sol";

contract CreditVoucher is ICreditVoucher, ERC721Enumerable, Pausable, EIP712, Ownable {
    using SafeERC20 for IERC20;
    using SignatureChecker for address;

    bytes32 public constant VERSION = keccak256("CREDIT_VOUCHER_V1");
    // keccak256("Mint(address to,uint256 creditValue,uint256 validityDuration,uint256 nonce,uint256 deadline)")
    bytes32 private constant MINT_TYPEHASH = 0x8273ad6602a685a4f5d7ecbc8bd3d12143e571c328549ec6589a11d3524466ce;

    IERC20 public immutable USDC;

    address public operator;
    uint256 public validityDuration;
    uint256 public totalCredits;
    string public baseTokenURI;

    mapping(uint256 => Voucher) public vouchers;

    // the nonces mapping is given for replay protection
    mapping(address => uint256) public sigNonces;

    constructor(
        address _operator,
        address _usdc,
        string memory _uri
    ) ERC721("CreditVoucher", "CV") EIP712("TRVLCreditVoucher", "1") Ownable(_msgSender()) {
        if (_operator == address(0) || _usdc == address(0)) {
            revert ZeroAddress();
        }
        operator = _operator;
        USDC = IERC20(_usdc);
        baseTokenURI = _uri;

        // Token transfers are disabled by default, except for minting/burning
        _pause();
    }

    function _update(address to, uint256 tokenId, address auth) internal override(ERC721Enumerable) returns (address) {
        if (paused()) {
            if (_ownerOf(tokenId) != address(0) || to != address(0)) {
                revert TransferWhilePaused();
            }
        }
        return super._update(to, tokenId, auth);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
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
     * @notice Set base token URI
     * @dev    Caller must be CONTRACT OWNER or OPERATOR
     * @param _uri Th new token base URI
     */
    function setBaseTokenURI(string calldata _uri) external {
        address msgSender = _msgSender();
        if (msgSender != owner() && msgSender != operator) {
            revert Unauthorized();
        }
        baseTokenURI = _uri;
        emit NewBaseTokenURI(_uri);
    }

    /**
     * @notice Disable token transfer
     * @dev Caller must be CONTRACT OWNER
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Enable token transfer
     * @dev Caller must be CONTRACT OWNER
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Lazy mint a credit voucher token
     * @dev    Caller can be ANYONE
     * @param _to The new voucher owner
     * @param _validityDuration The validity duration to redeem the voucher
     * @param _deadline The deadline timestamp by which the call must be mined for the approve to work
     * @param _signature The signature provided by token owner
     */
    function mint(
        address _to,
        uint256 _creditValue,
        uint256 _validityDuration,
        uint256 _deadline,
        bytes calldata _signature
    ) public {
        if (_msgSender() != _to) {
            revert InvalidMsgSender();
        }

        if (totalCredits + _creditValue > USDC.balanceOf(address(this))) {
            revert InsufficientUSDCReserve();
        }

        bytes32 structHash = keccak256(abi.encode(MINT_TYPEHASH, _to, _creditValue, sigNonces[_to]++, _deadline));
        bytes32 digest = _hashTypedDataV4(structHash);
        _validateRecoveredAddress(digest, operator, _deadline, _signature);

        uint256 tokenId = totalSupply() + 1;
        _safeMint(_to, tokenId);
        vouchers[tokenId] = Voucher(_creditValue, _validityDuration, block.timestamp, 0, false);

        totalCredits += _creditValue;

        emit Minted(_to, tokenId, _creditValue);
    }

    /**
     * @notice Redeem a voucher for its pegged token equivalent
     * @dev    Caller can be ANYONE
     * @param _tokenId The tokenId to be redeemed
     */
    function redeem(uint256 _tokenId) public {
        address msgSender = _msgSender();
        if (ownerOf(_tokenId) != msgSender) {
            revert NotVoucherOwner();
        }
        Voucher storage voucher = vouchers[_tokenId];
        uint256 current = block.timestamp;
        if (current > voucher.createdAt + voucher.validityDuration) {
            revert VoucherExpired();
        }

        if (voucher.redeemed) {
            revert VoucherRedeemed();
        }

        voucher.redeemedAt = current;
        voucher.redeemed = true;
        totalCredits -= voucher.creditValue;
        _burn(_tokenId);

        IERC20(USDC).transfer(msgSender, voucher.creditValue);

        emit Redeemed(msgSender, _tokenId);
    }

    /**
     * @notice Burn a voucher
     * @dev    Caller can be ANYONE
     * @param _tokenId The tokenId to be redeemed
     */
    function burn(uint256 _tokenId) public {
        _burn(_tokenId);
    }

    function _validateRecoveredAddress(
        bytes32 _digest,
        address _verifier,
        uint256 _deadline,
        bytes calldata _signature
    ) private view {
        if (block.timestamp > _deadline) {
            revert MintExpired();
        }

        if (!_verifier.isValidSignatureNow(_digest, _signature)) {
            revert InvalidMintSignature();
        }
    }
}
