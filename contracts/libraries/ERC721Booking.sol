// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Metadata} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

abstract contract ERC721Booking is Context, ERC165, IERC721, IERC721Metadata, ReentrancyGuard {
    using Strings for uint256;

    /*============================================================
                        METADATA STORAGE/LOGIC
    ============================================================*/
    address public immutable HOST;

    string public name;

    string public symbol;

    string public baseTokenURI;

    function tokenURI(uint256 tokenId) public view virtual returns (string memory) {
        string memory baseURI = baseTokenURI;
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, tokenId.toString())) : "";
    }

    /*============================================================
                        BOOKING DATA STORAGE
    ============================================================*/
    struct Booking {
        uint256 checkIn;
        uint256 checkOut;
        bytes data;
    }

    uint256 public bookingCounter;

    mapping(uint256 tokenId => uint256) public bookingIds;

    mapping(uint256 bookingId => Booking) public bookings;

    function _createBooking(uint256 fromId, uint256 toId, bytes memory data) internal virtual {
        unchecked {
            bookingCounter++;
        }

        bookings[bookingCounter] = Booking(fromId, toId, data);
        uint256 tokenId = fromId;
        while (tokenId <= toId) {
            bookingIds[tokenId] = bookingCounter;
            unchecked {
                tokenId++;
            }
        }
    }

    function _deleteBooking(uint256 fromId, uint256 toId) internal virtual {
        uint256 bookingId = bookingIds[fromId];
        if (bookingId != bookingIds[toId]) {
            revert MismatchedBookingIds();
        }

        if (bookings[bookingId].checkOut != toId) {
            revert InvalidCheckoutTokenId();
        }

        uint256 tokenId = fromId;
        while (tokenId <= toId) {
            delete bookingIds[tokenId];
            unchecked {
                tokenId++;
            }
        }

        delete bookings[bookingId];
    }

    /*============================================================
                    ERC721 BALANCE/OWNER STORAGE
    ============================================================*/
    mapping(uint256 tokenId => address) internal _bookedBy;

    mapping(address owner => uint256) internal _balanceOf;

    function ownerOf(uint256 tokenId) public view virtual returns (address) {
        if (_bookedBy[tokenId] == address(0)) return HOST;
        return _bookedBy[tokenId];
    }

    function balanceOf(address owner) public view virtual returns (uint256) {
        if (owner == address(0)) {
            revert ZeroAddress();
        }
        return _balanceOf[owner];
    }

    /*============================================================
                        ERC721 APPROVAL STORAGE
    ============================================================*/
    mapping(uint256 tokenId => address) public getApproved;

    mapping(address owner => mapping(address => bool)) public isApprovedForAll;

    /*============================================================
                            CONSTRUCTOR
    ============================================================*/

    constructor(address _host, string memory _name, string memory _symbol) {
        if (_host == address(0)) {
            revert ZeroAddress();
        }
        HOST = _host;
        name = _name;
        symbol = _symbol;
    }

    /*============================================================
                            ERC721 LOGIC
    ============================================================*/
    function approve(address spender, uint256 tokenId) public virtual {
        address owner = ownerOf(tokenId);

        if (spender == owner) {
            revert ApprovalExisted();
        }

        address msgSender = _msgSender();
        if (msgSender != owner && !isApprovedForAll[owner][msgSender]) {
            revert Unauthorized();
        }

        _approve(spender, tokenId);
    }

    function _approve(address spender, uint256 tokenId) internal virtual {
        getApproved[tokenId] = spender;

        emit Approval(ownerOf(tokenId), spender, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) public virtual {
        _setApprovalForAll(_msgSender(), operator, approved);
    }

    function _setApprovalForAll(address owner, address operator, bool approved) internal virtual {
        if (owner == operator) {
            revert WrongOperator();
        }

        isApprovedForAll[owner][operator] = approved;

        emit ApprovalForAll(owner, operator, approved);
    }

    function _transferFrom(address from, address to, uint256 tokenId, bytes memory data) internal virtual {
        _validateOwnerAndSender(from, tokenId);

        _beforeTokenTransfer(from, to, tokenId, 0);

        _updateBookingAndBalance(from, to, tokenId, tokenId, data);
        _updateTokenStorage(from, to, tokenId);

        _afterTokenTransfer(from, to, tokenId, 0);
    }

    function transferFrom(address from, address to, uint256 tokenId) public virtual nonReentrant {
        _transferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) public virtual nonReentrant {
        _transferFrom(from, to, tokenId, "");
        _validateRecipient(from, to, tokenId, "");
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata data
    ) public virtual nonReentrant {
        _transferFrom(from, to, tokenId, data);
        _validateRecipient(from, to, tokenId, data);
    }

    function _updateTokenStorage(address from, address to, uint256 tokenId) internal virtual {
        _bookedBy[tokenId] = to;

        delete getApproved[tokenId];

        emit Transfer(from, to, tokenId);
    }

    function _updateBookingAndBalance(
        address from,
        address to,
        uint256 fromId,
        uint256 toId,
        bytes memory data
    ) internal virtual {
        uint256 amount = toId - fromId + 1;
        if (_bookedBy[fromId] == address(0)) {
            _createBooking(fromId, toId, data);
        } else {
            // Underflow of the sender's balance is impossible because we check for
            // ownership above and the recipient's balance can't realistically overflow.
            unchecked {
                _balanceOf[from] -= amount;
            }
        }

        if (to == address(0)) {
            _deleteBooking(fromId, toId);
        } else {
            unchecked {
                _balanceOf[to] += amount;
            }
        }
    }

    function _validateOwnerAndSender(address from, uint256 tokenId) internal virtual {
        if (from != ownerOf(tokenId)) {
            revert WrongFrom();
        }

        address msgSender = _msgSender();
        if (msgSender != from && !isApprovedForAll[from][msgSender] && msgSender != getApproved[tokenId]) {
            revert Unauthorized();
        }
    }

    function _validateRecipient(address from, address to, uint256 tokenId, bytes memory data) internal virtual {
        if (
            to.code.length != 0 &&
            IERC721Receiver(to).onERC721Received(_msgSender(), from, tokenId, data) !=
            IERC721Receiver.onERC721Received.selector
        ) {
            revert UnsafeRecipient();
        }
    }

    /*============================================================
                            BULK TRANSFER LOGIC
    ============================================================*/
    function _safeBulkTransferFrom(
        address from,
        address to,
        uint256 fromId,
        uint256 toId,
        bytes memory data
    ) internal virtual {
        if (fromId >= toId) {
            revert InvalidTokenId();
        }

        _beforeTokenTransfer(from, to, fromId, toId);

        _updateBookingAndBalance(from, to, fromId, toId, data);

        uint256 tokenId = fromId;
        while (tokenId <= toId) {
            _validateOwnerAndSender(from, tokenId);
            _validateRecipient(from, to, tokenId, data);

            _updateTokenStorage(from, to, tokenId);

            unchecked {
                tokenId += 1;
            }
        }

        _afterTokenTransfer(from, to, fromId, toId);
    }

    function safeBulkTransferFrom(address from, address to, uint256 fromId, uint256 toId) public virtual nonReentrant {
        _safeBulkTransferFrom(from, to, fromId, toId, "");
    }

    function safeBulkTransferFrom(
        address from,
        address to,
        uint256 fromId,
        uint256 toId,
        bytes calldata data
    ) public virtual nonReentrant {
        _safeBulkTransferFrom(from, to, fromId, toId, data);
    }

    /*============================================================
                            ERC165 LOGIC
    ============================================================*/
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return
            interfaceId == type(IERC721).interfaceId ||
            interfaceId == type(IERC721Metadata).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /*============================================================
                            TRANSFER HOOKS
    ============================================================*/
    /* solhint-disable */
    function _beforeTokenTransfer(address from, address to, uint256 fromId, uint256 toId) internal virtual {}

    /* solhint-disable */
    function _afterTokenTransfer(address from, address to, uint256 fromId, uint256 toId) internal virtual {}
    /* solhint-enable */

    /*============================================================
                            CUSTOM ERRORS
    ============================================================*/
    error ZeroAddress();
    error Unauthorized();
    error ApprovalExisted();
    error WrongOperator();
    error WrongFrom();
    error UnsafeRecipient();
    error InvalidTokenId();
    error MismatchedBookingIds();
    error InvalidCheckoutTokenId();
}
