
import { network } from "hardhat";

const { ethers } = await network.create();

async function main() {
  const registry = await ethers.getContractAt(
    "ExamRegistry",
    "0x3D641a2791533B4A0000345eA8d509d01E1ec301",
  );

  const examId = 1n;
  const signers = await ethers.getSigners();

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
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
