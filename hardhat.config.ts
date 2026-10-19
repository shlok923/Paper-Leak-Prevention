import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";
import "dotenv/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.34",
        settings: {
          evmVersion: "cancun",
        },
      },
      production: {
        version: "0.8.34",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    cosmosLocal: {
      type: "http",
      chainType: "generic",
      chainId: 262144,
      url: "http://127.0.0.1:8545",
      accounts: [
        process.env.COSMOS_LOCAL_PRIVATE_KEY!,
        process.env.SERVER1_PRIVATE_KEY!,
        process.env.SERVER2_PRIVATE_KEY!,
        process.env.SERVER3_PRIVATE_KEY!,
        process.env.SERVER4_PRIVATE_KEY!,
      ],
    },
  },
});
