import { network } from "hardhat";

const { ethers } = await network.create();

const REGISTRY_ADDRESS =
  "0xa7F16731951d943768cf2053485b69EF61feF8Be";

const COORDINATOR_ADDRESS =
  "0x28108934A16e88cAC49dD4A527fe9A87CE526173";

const EXAM_ID = 1n;

async function main() {
  const signers = await ethers.getSigners();

  const registry = await ethers.getContractAt(
    "ExamRegistry",
    REGISTRY_ADDRESS,
  );

  const coordinator = await ethers.getContractAt(
    "MockRandomnessCoordinator",
    COORDINATOR_ADDRESS,
  );

  const results: {
    server: string;
    requestId: bigint;
    ids: bigint[];
  }[] = [];

  for (let i = 1; i <= 4; i++) {
    const server = signers[i];
    const serverAddress = await server.getAddress();

    const authorized = await registry.isServerAuthorized(
      EXAM_ID,
      serverAddress,
    );

    if (!authorized) {
      throw new Error(`Server ${i} is not authorized`);
    }

    // Read the next request ID before submitting.
    const requestId = await registry.nextRequestId();

    // Each server submits its own request.
    const requestTx = await registry
      .connect(server)
      .requestQuestions(EXAM_ID);

    await requestTx.wait();

    console.log(
      `\nServer ${i} submitted request ${requestId}`,
    );

    // TEST ONLY: supply a deterministic mock random word.
    const mockRandomWord = BigInt(
      123456789 + i * 98765,
    );

    // Simulate the asynchronous oracle callback.
    const fulfillmentTx = await coordinator.fulfill(
      REGISTRY_ADDRESS,
      requestId,
      mockRandomWord,
    );

    await fulfillmentTx.wait();

    const ids = await registry.getQuestionIds(requestId);

    const uniqueIds = new Set(
      ids.map((id: bigint) => id.toString()),
    );

    const allInRange = ids.every(
      (id: bigint) => id >= 1n && id <= 100n,
    );

    if (
      ids.length !== 20 ||
      uniqueIds.size !== 20 ||
      !allInRange
    ) {
      throw new Error(
        `Validation failed for server ${i}`,
      );
    }

    console.log("Question count:", ids.length);
    console.log("Unique IDs:", uniqueIds.size);
    console.log(
      "Question IDs:",
      ids.map((id: bigint) => id.toString()).join(", "),
    );

    results.push({
      server: serverAddress,
      requestId,
      ids,
    });
  }

  console.log("\n--- Pairwise overlap report ---");

  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      const first = new Set(
        results[i].ids.map((id) => id.toString()),
      );

      const overlap = results[j].ids.filter(
        (id) => first.has(id.toString()),
      ).length;

      console.log(
        `Server ${i + 1} vs Server ${j + 1}: ${overlap} shared questions`,
      );
    }
  }

  console.log("\nAll four server selections passed validation.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});