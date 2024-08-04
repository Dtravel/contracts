// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

interface INiteToken {
    function setName(string calldata _name) external;
    function setBaseURI(string calldata _uri) external;
    function pause() external;
    function unpause() external;
    function permit(address _spender, uint256 _value, uint256 _deadline, bytes calldata _signature) external;
    function permitForAll(
        address _owner,
        address _operator,
        bool _approved,
        uint256 _deadline,
        bytes calldata _signature
    ) external;
    function transferWithPermit(address _to, uint256 _tokenId, uint256 _deadline, bytes calldata _signature) external;

    event SetWhitelist(address indexed addr, bool isWhitelist);
    event WithdrawGasToken(address indexed to, uint256 amount);

    error OnlyHost();
    error TransferWhilePaused();
    error ApprovalToCurrentOwner();
    error PermitExpired();
    error InvalidPermitSignature();
}
