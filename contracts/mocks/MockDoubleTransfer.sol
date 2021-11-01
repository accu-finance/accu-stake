// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;

import "../interfaces/IERC20.sol";

contract MockDoubleTransfer {
    IERC20 public immutable ACCU;

    constructor(IERC20 accu) {
        ACCU = accu;
    }

    function doubleSend(
        address to,
        uint256 amount1,
        uint256 amount2
    ) external {
        ACCU.transfer(to, amount1);
        ACCU.transfer(to, amount2);
    }
}
