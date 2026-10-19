// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRandomnessCoordinator {
    function requestRandomness(uint256 requestId) external;
}

interface IRandomnessConsumer {
    function fulfillRandomness(
        uint256 requestId,
        uint256 randomWord
    ) external;
}