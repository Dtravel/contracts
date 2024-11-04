// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

interface ICreditVoucher {
    struct Voucher {
        uint256 creditValue;
        uint256 createdAt;
        uint256 redeemedAt;
        bool redeemed;
    }

    function setOperator(address _addr) external;
    function setValidityDuration(uint256 _duration) external;
    function pause() external;
    function unpause() external;
    function mint(address _to, uint256 _creditValue, uint256 _deadline, bytes calldata _signature) external;
    function redeem(uint256 _tokenId) external;

    event NewOperator(address indexed newOperator);
    event NewValidityDuration(uint256 duration);
    event Minted(address indexed owner, uint256 indexed tokenId, uint256 creditValue);
    event Redeemed(address indexed owner, uint256 indexed tokenId);

    error ZeroAddress();
    error OnlyOperator();
    error NotVoucherOwner();
    error InvalidMsgSender();
    error MintExpired();
    error InvalidMintSignature();
    error VoucherExpired();
    error VoucherRedeemed();
    error TransferWhilePaused();
}
