pragma tvm-solidity >= 0.72.0;
// Use expiration time for external messages
pragma AbiHeader expire;

import {CommonConstants} from "CommonConstants.sol";

contract Counter is CommonConstants {

    // Note: only `static` state variables are used to generate contract `stateInit` and influence on
    // generated contract address.
    mapping(address => bool) static isAllowed;
    // All not `static` state variables are set to default values.
    mapping(address => uint) count;

    uint16 constant ERROR_NOT_ALLOWED = 101;
    uint16 constant ERROR_NOT_OWNER = 102;

    modifier allowed(address addr) {
        require(isAllowed[addr], ERROR_NOT_ALLOWED);
        _;
    }

    modifier onlyOwner {
        require(tvm.pubkey() == msg.pubkey(), ERROR_NOT_OWNER);
        _;
    }

    // Function is support to be called only by internal message.
    function inc() public allowed(msg.sender) {
        ++count[msg.sender];
        returnChange();
    }

    // Function is support to be called only by external message.
    function grant(address user, uint value) public onlyOwner allowed(user) {
        tvm.accept();
        count[user] += value;
    }

    // Internal function that is not part of ABI (See Counter.abi.json).
    function returnChange() internal {
        uint leaveOnBalance = address(this).balance - msg.value + tx.storageFees;
        // Reserve at most `leaveOnBalance` ton on the contract balance
        tvm.rawReserve(leaveOnBalance, RESERVE_AT_MOST);
        // Send back all remaining balance
        msg.sender.transfer({value: 0, flag: SEND_MODE_CARRY_ALL_BALANCE | SEND_MODE_IGNORE_ERRORS});
    }

    // Getters:

    function getCount(address user) getter returns(uint qty) {
        return count[user];
    }

    function getIsAllowed(address user) getter returns(bool) {
        return isAllowed[user];
    }
}
