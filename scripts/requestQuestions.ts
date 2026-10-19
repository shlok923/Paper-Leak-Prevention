
import { network } from "hardhat";

const { ethers } = await network.create();

const REGISTRY_ADDRESS =
  "0xa7F16731951d943768cf2053485b69EF61feF8Be";

const COORDINATOR_ADDRESS =
  "0x28108934A16e88cAC49dD4A527fe9A87CE526173";

async function main() {
  const signers = await ethers.getSigners();
  const server1 = signers[1];

  const registry = await ethers.getContractAt(
    "ExamRegistry",
    REGISTRY_ADDRESS,
  );

  const coordinator = await ethers.getContractAt(
    "MockRandomnessCoordinator",
    COORDINATOR_ADDRESS,
  );

  const serverAddress = await server1.getAddress();

  console.log("Server 1:", serverAddress);
  console.log("Exam ID: 1");

  // Get the next request ID before submitting the transaction.
  const requestId = await registry.nextRequestId();

  // 1. Server 1 requests its question set.
  const requestTx = await registry
    .connect(server1)
    .requestQuestions(1);

  await requestTx.wait();

  console.log("\nRequest submitted:", requestId.toString());

  // 2. Verify the request is pending.
  const pendingRequest = await registry.requests(requestId);

  console.log("Requester:", pendingRequest.requester);
  console.log("Fulfilled:", pendingRequest.fulfilled);

  // 3. Simulate a randomness oracle callback.
  // This random word is chosen by us, so this is NOT secure randomness.
  const mockRandomWord = 123456789n;

  const fulfillmentTx = await coordinator.fulfill(
    REGISTRY_ADDRESS,
    requestId,
    mockRandomWord,
  );

  await fulfillmentTx.wait();

  console.log("\nMock oracle callback completed.");

  // 4. Retrieve the selected question IDs.
  const fulfilledRequest = await registry.requests(requestId);
  const questionIds = await registry.getQuestionIds(requestId);

  const uniqueIds = new Set(
    questionIds.map((id: bigint) => id.toString()),
  );

  const allInRange = questionIds.every(
    (id: bigint) => id >= 1n && id <= 100n,
  );

  console.log("Fulfilled:", fulfilledRequest.fulfilled);
  console.log("Number of questions:", questionIds.length);
  console.log("Unique question IDs:", uniqueIds.size);
  console.log("All IDs between 1 and 100:", allInRange);
  console.log(
    "Selected IDs:",
    questionIds.map((id: bigint) => id.toString()).join(", "),
  );

  if (
    !fulfilledRequest.fulfilled ||
    questionIds.length !== 20 ||
    uniqueIds.size !== 20 ||
    !allInRange
  ) {
    throw new Error("Question selection validation failed");
  }

  console.log("\nQuestion selection validation passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
