// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IRandomness.sol";

contract MockRandomnessCoordinator is IRandomnessCoordinator {
    mapping(uint256 => mapping(address => bool)) public pendingRequests;

    error RequestAlreadyExists();
    error UnknownRequest();

    event RandomnessRequested(
        uint256 indexed requestId,
        address indexed consumer
    );

    event RandomnessFulfilled(
        uint256 indexed requestId,
        address indexed consumer,
        uint256 randomWord
    );

    function requestRandomness(
        uint256 requestId
    ) external override {
        if (pendingRequests[requestId][msg.sender]) {
            revert RequestAlreadyExists();
        }

        pendingRequests[requestId][msg.sender] = true;

        emit RandomnessRequested(requestId, msg.sender);
    }

    // TEST ONLY: anyone can choose the random word.
    // This function must never be used as a production oracle.
    function fulfill(
        address consumer,
        uint256 requestId,
        uint256 randomWord
    ) external {
        if (!pendingRequests[requestId][consumer]) {
            revert UnknownRequest();
        }

        delete pendingRequests[requestId][consumer];

        IRandomnessConsumer(consumer).fulfillRandomness(
            requestId,
            randomWord
        );

        emit RandomnessFulfilled(
            requestId,
            consumer,
            randomWord
        );
    }
}
