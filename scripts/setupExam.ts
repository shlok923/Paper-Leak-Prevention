import { network } from "hardhat";

const { ethers } = await network.create();

async function main() {
  const registry = await ethers.getContractAt(
    "ExamRegistry",
    "0xa7F16731951d943768cf2053485b69EF61feF8Be",
  );

  const signers = await ethers.getSigners();

  if (signers.length < 5) {
    throw new Error(
      `Expected 5 configured signers, found ${signers.length}`,
    );
  }

  // Read the next available exam ID before creating the exam.
  const examId = await registry.nextExamId();

  // Demo commitment only; this is not a hash of real questions.
  const poolHash = ethers.keccak256(
    ethers.toUtf8Bytes("demo-question-pool-v1"),
  );

  const createTx = await registry.createExam(
    poolHash,
    100,
    20,
  );
  await createTx.wait();

  console.log("Created exam:", examId.toString());

  // Signer 0 is the administrator.
  // Signers 1–4 are the four exam servers.
  for (let i = 1; i <= 4; i++) {
    const serverAddress = await signers[i].getAddress();

    const tx = await registry.authorizeServer(
      examId,
      serverAddress,
    );
    await tx.wait();

    const authorized = await registry.isServerAuthorized(
      examId,
      serverAddress,
    );

    console.log(
      `Server ${i}: ${serverAddress} | Authorized: ${authorized}`,
    );
  }

  const exam = await registry.exams(examId);

  console.log("Pool size:", exam.totalQuestions.toString());
  console.log(
    "Questions per request:",
    exam.questionsPerRequest.toString(),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});