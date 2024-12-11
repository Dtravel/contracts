// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

interface ICreditVoucher {
    struct Voucher {
        uint256 creditValue;
        uint256 validityDuration;
        uint256 createdAt;
        uint256 redeemedAt;
    }

    function setOperator(address _addr) external;
    function pause() external;
    function unpause() external;
    function mint(
        address _to,
        uint256 _creditValue,
        uint256 _validityDuration,
        uint256 _deadline,
        bytes calldata _signature
    ) external;
    function redeem(uint256 _tokenId) external;
    function burn(uint256 _tokenId) external;
    function batchBurn(uint256 _cursor, uint256 _size) external returns (uint256 _nextBurnCursor);

    event NewOperator(address indexed newOperator);
    event NewBaseTokenURI(string uri);
    event NewValidityDuration(uint256 duration);
    event Minted(address indexed owner, uint256 indexed tokenId, uint256 creditValue);
    event Redeemed(address indexed owner, uint256 indexed tokenId);

    error ZeroAddress();
    error OnlyOperator();
    error Unauthorized();
    error NotVoucherOwner();
    error InvalidMsgSender();
    error MintExpired();
    error InsufficientUSDCReserve();
    error InvalidMintSignature();
    error VoucherExpired();
    error VoucherUnexpiredYet();
    error VoucherRedeemed();
    error TransferWhilePaused();
}
