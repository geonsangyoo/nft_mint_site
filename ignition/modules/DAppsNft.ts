import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("DAppsNftModule", (m) => {
  // Defaults to the deploying account; override per network with --parameters.
  const deployer = m.getAccount(0);
  const defaultAdmin = m.getParameter("defaultAdmin", deployer);
  const pauser = m.getParameter("pauser", deployer);

  const dAppsNft = m.contract("DAppsNft", [defaultAdmin, pauser]);

  return { dAppsNft };
});
