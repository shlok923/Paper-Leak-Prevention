import { network } from "hardhat";

const { ethers } = await network.create();

async function main() {
  const signers = await ethers.getSigners();

  const deployer = signers[0];
  const server4 = signers[4];

  const deployerAddress = await deployer.getAddress();
  const server4Address = await server4.getAddress();

  console.log("Funding account:", deployerAddress);
  console.log("Server 4:", server4Address);

  const balanceBefore = await ethers.provider.getBalance(
    server4Address,
  );

  console.log(
    "Server 4 balance before:",
    ethers.formatEther(balanceBefore),
  );

  // Transfer 1 local EVM token to Server 4.
  const tx = await deployer.sendTransaction({
    to: server4Address,
    value: ethers.parseEther("1"),
  });

  await tx.wait();

  const balanceAfter = await ethers.provider.getBalance(
    server4Address,
  );

  console.log("Funding transaction:", tx.hash);
  console.log(
    "Server 4 balance after:",
    ethers.formatEther(balanceAfter),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});