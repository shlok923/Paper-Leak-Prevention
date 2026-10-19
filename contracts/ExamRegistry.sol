// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IRandomness.sol";

contract ExamRegistry is IRandomnessConsumer {
    struct Exam {
        address administrator;
        bytes32 poolHash;
        uint16 totalQuestions;
        uint16 questionsPerRequest;
        bool active;
    }

    struct QuestionRequest {
        uint256 examId;
        address requester;
        uint16 requestedCount;
        bool fulfilled;
        bool exists;
    }

    uint256 public nextExamId = 1;
    uint256 public nextRequestId = 1;

    address public immutable randomnessCoordinator;

    mapping(uint256 => Exam) public exams;
    mapping(uint256 => mapping(address => bool)) public authorizedServers;
    mapping(uint256 => QuestionRequest) public requests;

    mapping(uint256 => uint16[]) private selectedQuestionIds;

    error Unauthorized();
    error UnauthorizedCoordinator();
    error InvalidCoordinator();
    error InvalidExamConfiguration();
    error ExamNotActive();
    error UnknownRequest();
    error RequestAlreadyFulfilled();
    error RequestNotFulfilled();
    error RandomnessSamplingFailed();

    event ExamCreated(
        uint256 indexed examId,
        address indexed administrator,
        bytes32 poolHash,
        uint16 totalQuestions,
        uint16 questionsPerRequest
    );

    event ServerAuthorized(
        uint256 indexed examId,
        address indexed server
    );

    event ExamClosed(uint256 indexed examId);

    event QuestionRequestCreated(
        uint256 indexed requestId,
        uint256 indexed examId,
        address indexed requester
    );

    event QuestionsSelected(
        uint256 indexed requestId,
        uint256 indexed examId,
        address indexed requester,
        uint16[] questionIds
    );

    constructor(address coordinator) {
        if (coordinator == address(0)) {
            revert InvalidCoordinator();
        }

        randomnessCoordinator = coordinator;
    }

    modifier onlyAdministrator(uint256 examId) {
        if (exams[examId].administrator != msg.sender) {
            revert Unauthorized();
        }
        _;
    }

    function createExam(
        bytes32 poolHash,
        uint16 totalQuestions,
        uint16 questionsPerRequest
    ) external returns (uint256 examId) {
        if (
            poolHash == bytes32(0) ||
            totalQuestions == 0 ||
            questionsPerRequest == 0 ||
            questionsPerRequest > totalQuestions
        ) {
            revert InvalidExamConfiguration();
        }

        examId = nextExamId++;

        exams[examId] = Exam({
            administrator: msg.sender,
            poolHash: poolHash,
            totalQuestions: totalQuestions,
            questionsPerRequest: questionsPerRequest,
            active: true
        });

        emit ExamCreated(
            examId,
            msg.sender,
            poolHash,
            totalQuestions,
            questionsPerRequest
        );
    }

    function authorizeServer(
        uint256 examId,
        address server
    ) external onlyAdministrator(examId) {
        if (!exams[examId].active || server == address(0)) {
            revert InvalidExamConfiguration();
        }

        authorizedServers[examId][server] = true;

        emit ServerAuthorized(examId, server);
    }

    function closeExam(
        uint256 examId
    ) external onlyAdministrator(examId) {
        if (!exams[examId].active) {
            revert ExamNotActive();
        }

        exams[examId].active = false;
        emit ExamClosed(examId);
    }

    function isServerAuthorized(
        uint256 examId,
        address server
    ) external view returns (bool) {
        return exams[examId].active &&
            authorizedServers[examId][server];
    }

    function requestQuestions(
        uint256 examId
    ) external returns (uint256 requestId) {
        Exam storage exam = exams[examId];

        if (!exam.active) {
            revert ExamNotActive();
        }

        if (!authorizedServers[examId][msg.sender]) {
            revert Unauthorized();
        }

        requestId = nextRequestId++;

        requests[requestId] = QuestionRequest({
            examId: examId,
            requester: msg.sender,
            requestedCount: exam.questionsPerRequest,
            fulfilled: false,
            exists: true
        });

        emit QuestionRequestCreated(
            requestId,
            examId,
            msg.sender
        );

        // The request is recorded before calling the coordinator.
        IRandomnessCoordinator(randomnessCoordinator)
            .requestRandomness(requestId);
    }

    function fulfillRandomness(
        uint256 requestId,
        uint256 randomWord
    ) external override {
        if (msg.sender != randomnessCoordinator) {
            revert UnauthorizedCoordinator();
        }

        QuestionRequest storage request = requests[requestId];

        if (!request.exists) {
            revert UnknownRequest();
        }

        if (request.fulfilled) {
            revert RequestAlreadyFulfilled();
        }

        Exam storage exam = exams[request.examId];

        // Prevent a second successful fulfillment.
        request.fulfilled = true;

        uint16[] memory ids = _selectQuestions(
            exam.totalQuestions,
            request.requestedCount,
            randomWord,
            requestId
        );

        for (uint256 i = 0; i < ids.length; i++) {
            selectedQuestionIds[requestId].push(ids[i]);
        }

        emit QuestionsSelected(
            requestId,
            request.examId,
            request.requester,
            ids
        );
    }

    function getQuestionIds(
        uint256 requestId
    ) external view returns (uint16[] memory) {
        QuestionRequest storage request = requests[requestId];

        if (!request.exists) {
            revert UnknownRequest();
        }

        if (!request.fulfilled) {
            revert RequestNotFulfilled();
        }

        return selectedQuestionIds[requestId];
    }

    // Floyd's sampling algorithm selects k unique IDs without
    // allocating an array containing every question in the pool.
    function _selectQuestions(
        uint16 totalQuestions,
        uint16 requestedCount,
        uint256 randomWord,
        uint256 requestId
    ) internal pure returns (uint16[] memory selected) {
        selected = new uint16[](requestedCount);

        uint256 start =
            uint256(totalQuestions) - uint256(requestedCount);

        for (uint256 i = 0; i < requestedCount; i++) {
            uint256 j = start + i;

            uint256 candidate = _uniformBelow(
                randomWord,
                requestId,
                i,
                j + 1
            );

            bool alreadyPicked = false;

            for (uint256 k = 0; k < i; k++) {
                if (uint256(selected[k]) == candidate + 1) {
                    alreadyPicked = true;
                    break;
                }
            }

            // If the candidate was already selected, choose j.
            selected[i] = uint16(
                (alreadyPicked ? j : candidate) + 1
            );
        }

        // Randomize the ordering of the selected IDs as well.
        for (uint256 i = requestedCount; i > 1; i--) {
            uint256 j = _uniformBelow(
                randomWord,
                requestId,
                uint256(requestedCount) + i,
                i
            );

            (selected[i - 1], selected[j]) =
                (selected[j], selected[i - 1]);
        }
    }

    // Rejection sampling avoids modulo bias, assuming the seed
    // is unpredictable and the hash behaves as a pseudorandom function.
    function _uniformBelow(
        uint256 randomWord,
        uint256 requestId,
        uint256 drawIndex,
        uint256 bound
    ) internal pure returns (uint256) {
        uint256 maxValue = type(uint256).max;
        uint256 limit = maxValue - (maxValue % bound);

        for (uint256 nonce = 0; nonce < 10; nonce++) {
            uint256 candidate = uint256(
                keccak256(
                    abi.encode(
                        randomWord,
                        requestId,
                        drawIndex,
                        nonce
                    )
                )
            );

            if (candidate < limit) {
                return candidate % bound;
            }
        }

        revert RandomnessSamplingFailed();
    }
}
