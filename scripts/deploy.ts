import { network } from "hardhat";

const { ethers } = await network.create();

async function main() {
  const signers = await ethers.getSigners();

  console.log("Deployer:", await signers[0].getAddress());

  // 1. Deploy the test-only randomness coordinator.
  const coordinator = await ethers.deployContract(
    "MockRandomnessCoordinator",
  );

  await coordinator.waitForDeployment();

  const coordinatorAddress = await coordinator.getAddress();

  console.log("Mock coordinator:", coordinatorAddress);

  // 2. Deploy ExamRegistry and provide the coordinator address.
  const registry = await ethers.deployContract("ExamRegistry", [
    coordinatorAddress,
  ]);

  await registry.waitForDeployment();

  const registryAddress = await registry.getAddress();

  console.log("ExamRegistry:", registryAddress);

  // 3. Verify the deployed network.
  const chain = await ethers.provider.getNetwork();

  console.log("EVM chain ID:", chain.chainId.toString());
  console.log(
    "Registry bytecode deployed:",
    (await ethers.provider.getCode(registryAddress)) !== "0x",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});