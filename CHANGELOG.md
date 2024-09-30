# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 4.0.1 (2024-08-24)

### Added

- Integrate on-chain booking data. ([#2](https://github.com/Dtravel/contracts/pull/2))
- Add fixed fees to payments. ([#3](https://github.com/Dtravel/contracts/pull/3))

## 4.0.0 (2024-08-08)

### Added

- Add commission fee to payments. ([#1](https://github.com/Dtravel/contracts/pull/1))
- Integrate TRVL as a gas token for Nite token transfers. ([#1](https://github.com/Dtravel/contracts/pull/1))

### Changed

- Upgrade to v4 contracts, building upon v3 with enhanced gas optimization, functionality, and library updates. ([#1](https://github.com/Dtravel/contracts/pull/1))

## 3.0.1 (2024-06-17)

### Added

- Refer to the v3 repo: https://github.com/Dtravel/booking-contracts-v3
- `Factory` allows for the creation of new `NiteToken` contracts.
  - Avoid duplicate NiteToken deployments for the same host by using slot.
- `NiteToken` complies with the ERC721 token standard. A Nite token is used to represent a particular room night. The token ID is based on the number of days between the night’s date and a predetermined date, such as 2024-1-1.
  - Include a whitelist to bypass transfer restrictions.
  - Inherit from `ERC721Booking` for core ERC-721 functionality, including:
    - `ownerOf(uint256 tokenId)`: Return the owner's address of a given token ID. If the token is not booked, it returns the host's address by default.
    - `balanceOf(address owner)`: Return the number of tokens booked by a given address.
    - `approve(address spender, uint256 tokenId)`: Approve a given address to spend a specific token.
    - `setApprovalForAll(address operator, bool approved)`: Set or revoke approval for an operator to transfer all tokens owned/booked by the caller.
    - `transferFrom(address from, address to, uint256 tokenId)`: Transfer a token from one address to another.
    - `safeTransferFrom(address from, address to, uint256 tokenId)`: Transfer a token from one address to another, with additional safety checks for contracts.
    - `safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data)`: Transfer a token from one address to another, with additional safety checks for contracts and optional data.
    - `safeBulkTransferFrom(address from, address to, uint256 fromId, uint256 toId)`: Transfer a bulk of tokens from one address to another, with safety checks.
    - `supportsInterface(bytes4 interfaceId)`: Return true if the contract implements the given interface.
    - `tokenURI(uint256 tokenId)`: Return the URI of the metadata for a given token ID.
  - `permit` and `permitForAll` functions for off-chain approvals, using EIP-712
  - `transferWithPermit` combines transfer and permit functionality.
  - `setWhitelist` function to manage whitelist addresses.
  - `setName` and `setBaseURI` functions for token metadata management.
  - `pause` and `unpause` functions to control token transfers. Token transfers are paused by default.
- `Payment.sol` facilitates payments using ERC-20 tokens or native coin.
  - Support multiple payments in a single transaction.
