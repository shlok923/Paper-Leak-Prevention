import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("ExamRegistry", function () {
  async function deployFixture() {
    const signers = await ethers.getSigners();

    const coordinator = await ethers.deployContract(
      "MockRandomnessCoordinator",
    );
    await coordinator.waitForDeployment();

    const registry = await ethers.deployContract("ExamRegistry", [
      await coordinator.getAddress(),
    ]);
    await registry.waitForDeployment();

    const poolHash = ethers.keccak256(
      ethers.toUtf8Bytes("question-pool-v1"),
    );

    return { signers, coordinator, registry, poolHash };
  }

  // ----- Existing exam functionality -----

  it("creates an exam with the correct configuration", async function () {
    const { signers, registry, poolHash } = await deployFixture();

    await registry.createExam(poolHash, 100, 20);

    const exam = await registry.exams(1);

    expect(exam.administrator).to.equal(
      await signers[0].getAddress(),
    );
    expect(exam.poolHash).to.equal(poolHash);
    expect(exam.totalQuestions).to.equal(100n);
    expect(exam.questionsPerRequest).to.equal(20n);
    expect(exam.active).to.equal(true);
    expect(await registry.nextExamId()).to.equal(2n);
  });

  it("rejects invalid exam configurations", async function () {
    const { registry, poolHash } = await deployFixture();

    await expect(
      registry.createExam(ethers.ZeroHash, 100, 20),
    ).to.be.revertedWithCustomError(
      registry,
      "InvalidExamConfiguration",
    );

    await expect(
      registry.createExam(poolHash, 0, 20),
    ).to.be.revertedWithCustomError(
      registry,
      "InvalidExamConfiguration",
    );

    await expect(
      registry.createExam(poolHash, 100, 0),
    ).to.be.revertedWithCustomError(
      registry,
      "InvalidExamConfiguration",
    );

    await expect(
      registry.createExam(poolHash, 100, 101),
    ).to.be.revertedWithCustomError(
      registry,
      "InvalidExamConfiguration",
    );
  });

  it("allows the administrator to authorize four servers", async function () {
    const { signers, registry, poolHash } = await deployFixture();

    await registry.createExam(poolHash, 100, 20);

    for (let i = 1; i <= 4; i++) {
      const server = await signers[i].getAddress();

      await registry.authorizeServer(1, server);

      expect(
        await registry.isServerAuthorized(1, server),
      ).to.equal(true);
    }
  });

  it("rejects authorization by a non-administrator", async function () {
    const { signers, registry, poolHash } = await deployFixture();

    await registry.createExam(poolHash, 100, 20);

    await expect(
      registry.connect(signers[1]).authorizeServer(
        1,
        await signers[2].getAddress(),
      ),
    ).to.be.revertedWithCustomError(registry, "Unauthorized");
  });

  it("revokes effective access when the exam is closed", async function () {
    const { signers, registry, poolHash } = await deployFixture();
    const server = await signers[1].getAddress();

    await registry.createExam(poolHash, 100, 20);
    await registry.authorizeServer(1, server);

    expect(
      await registry.isServerAuthorized(1, server),
    ).to.equal(true);

    await registry.closeExam(1);

    expect(
      await registry.isServerAuthorized(1, server),
    ).to.equal(false);

    expect((await registry.exams(1)).active).to.equal(false);
  });

  it("rejects question requests after the exam is closed", async function () {
    const { signers, registry, poolHash } = await deployFixture();
    const server = await signers[1].getAddress();

    await registry.createExam(poolHash, 100, 20);
    await registry.authorizeServer(1, server);
    await registry.closeExam(1);

    await expect(
      registry.connect(signers[1]).requestQuestions(1),
    ).to.be.revertedWithCustomError(registry, "ExamNotActive");
  });

  // ----- New randomness functionality -----

  it("rejects question requests from unauthorized servers", async function () {
    const { signers, registry, poolHash } = await deployFixture();

    await registry.createExam(poolHash, 100, 20);

    await expect(
      registry.connect(signers[1]).requestQuestions(1),
    ).to.be.revertedWithCustomError(registry, "Unauthorized");
  });

  it("selects 20 distinct question IDs after fulfillment", async function () {
    const { signers, coordinator, registry, poolHash } =
      await deployFixture();

    await registry.createExam(poolHash, 100, 20);

    const server = await signers[1].getAddress();
    await registry.authorizeServer(1, server);

    await registry.connect(signers[1]).requestQuestions(1);

    const request = await registry.requests(1);

    expect(request.examId).to.equal(1n);
    expect(request.requester).to.equal(server);
    expect(request.requestedCount).to.equal(20n);
    expect(request.fulfilled).to.equal(false);

    // Results must not be available before the callback.
    await expect(
      registry.getQuestionIds(1),
    ).to.be.revertedWithCustomError(
      registry,
      "RequestNotFulfilled",
    );

    // Test-only coordinator: this word is deliberately supplied
    // by the test, not generated by a secure randomness oracle.
    await coordinator.fulfill(
      await registry.getAddress(),
      1,
      123456789n,
    );

    const ids = await registry.getQuestionIds(1);

    expect(ids.length).to.equal(20);
    expect(new Set(ids.map((id: bigint) => id.toString())).size)
      .to.equal(20);

    for (const id of ids) {
      expect(id >= 1n && id <= 100n).to.equal(true);
    }

    expect((await registry.requests(1)).fulfilled).to.equal(true);
  });

  it("rejects callbacks from unauthorized addresses", async function () {
    const { signers, registry, poolHash } = await deployFixture();

    await registry.createExam(poolHash, 100, 20);
    await registry.authorizeServer(
      1,
      await signers[1].getAddress(),
    );

    await registry.connect(signers[1]).requestQuestions(1);

    await expect(
      registry.fulfillRandomness(1, 123n),
    ).to.be.revertedWithCustomError(
      registry,
      "UnauthorizedCoordinator",
    );
  });

  it("rejects a second fulfillment of the same request", async function () {
    const { signers, coordinator, registry, poolHash } =
      await deployFixture();

    await registry.createExam(poolHash, 100, 20);
    await registry.authorizeServer(
      1,
      await signers[1].getAddress(),
    );

    await registry.connect(signers[1]).requestQuestions(1);

    const registryAddress = await registry.getAddress();

    await coordinator.fulfill(registryAddress, 1, 123n);

    await expect(
      coordinator.fulfill(registryAddress, 1, 456n),
    ).to.be.revertedWithCustomError(
      coordinator,
      "UnknownRequest",
    );
  });
});