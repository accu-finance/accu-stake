import {BigNumberish} from 'ethers';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {
  AaveDistributionManager,
  AaveIncentivesController,
  DoubleTransferHelper,
  InitializableAdminUpgradeabilityProxy,
  MockAToken,
  MockMintableERC20,
  StakedAccu,
} from '../typechain';
import {Address, ContractId, ContractType} from '../types';
import {getContractAt} from './contractGetter';
import registerContractInJsonDb from './registerContractInJsonDb';

export const deployMockMintableERC20 = async (
  hre: HardhatRuntimeEnvironment,
  name: string,
  symbol: string
): Promise<MockMintableERC20> => {
  const {
    deployments: {deploy},
    getNamedAccounts,
    network,
  } = hre;
  const {deployer} = await getNamedAccounts();
  const contract = ContractId.MockMintableERC20;
  const result = await deploy(contract, {
    from: deployer,
    contract,
    args: [name, symbol],
  });
  console.log(`${contract}:\t ${result.address}`);
  await registerContractInJsonDb(ContractType.StakedAccu, contract, network.name, result);

  return await getContractAt(hre, contract, result.address);
};

export const deployStakedAccu = async (
  hre: HardhatRuntimeEnvironment,
  args: [Address, Address, BigNumberish, BigNumberish, Address, Address, BigNumberish, Address]
): Promise<StakedAccu> => {
  const {
    deployments: {deploy},
    getNamedAccounts,
    network,
  } = hre;
  const {deployer} = await getNamedAccounts();
  const contract = ContractId.StakedAccu;
  const result = await deploy(contract, {
    from: deployer,
    contract,
    args,
  });
  console.log(`${contract}:\t ${result.address}`);
  await registerContractInJsonDb(ContractType.StakedAccu, contract, network.name, result);

  return await getContractAt(hre, contract, result.address);
};

export const deployMockStakedAccuV2 = async (
  hre: HardhatRuntimeEnvironment,
  args: [Address, Address, BigNumberish, BigNumberish, Address, Address, BigNumberish, Address]
): Promise<StakedAccu> => {
  const {
    deployments: {deploy},
    getNamedAccounts,
    network,
  } = hre;
  const {deployer} = await getNamedAccounts();
  const contract = ContractId.MockStakedAccuV2;
  const result = await deploy(contract, {
    from: deployer,
    contract,
    args,
  });
  console.log(`${contract}:\t ${result.address}`);
  await registerContractInJsonDb(ContractType.StakedAccu, contract, network.name, result);

  return await getContractAt(hre, contract, result.address);
};

export const deployInitializableAdminUpgradeabilityProxy = async (
  hre: HardhatRuntimeEnvironment,
  name: ContractId
): Promise<InitializableAdminUpgradeabilityProxy> => {
  const {
    deployments: {deploy},
    getNamedAccounts,
    network,
  } = hre;
  const {deployer} = await getNamedAccounts();
  const contract = ContractId.InitializableAdminUpgradeabilityProxy;
  const result = await deploy(name, {
    from: deployer,
    contract,
  });
  console.log(`${contract}:\t ${result.address}`);
  await registerContractInJsonDb(ContractType.Proxy, name, network.name, result);

  return await getContractAt(hre, contract, result.address);
};

export const deployIncentivesController = async (
  hre: HardhatRuntimeEnvironment,
  args: [
    Address, // rewardToken,
    Address, // rewardsVault,
    Address, // psm,
    BigNumberish, // extraPsmReward,
    Address, // emissionManager,
    BigNumberish // distributionDuration
  ]
): Promise<AaveIncentivesController> => {
  const {
    deployments: {deploy},
    getNamedAccounts,
    network,
  } = hre;
  const {deployer} = await getNamedAccounts();
  const contract = ContractId.IncentivesController;
  const result = await deploy(contract, {
    from: deployer,
    contract,
    args,
  });
  console.log(`${contract}:\t ${result.address}`);
  await registerContractInJsonDb(ContractType.IncentivesController, contract, network.name, result);

  return await getContractAt(hre, contract, result.address);
};

export const deployDistributionManager = async (hre: HardhatRuntimeEnvironment): Promise<AaveDistributionManager> => {
  const {
    deployments: {deploy},
    getNamedAccounts,
    network,
  } = hre;
  const {deployer} = await getNamedAccounts();
  const contract = ContractId.DistributionManager;
  const result = await deploy(contract, {
    from: deployer,
    contract,
  });
  console.log(`${contract}:\t ${result.address}`);
  await registerContractInJsonDb(ContractType.StakedAccu, contract, network.name, result);

  return await getContractAt(hre, contract, result.address);
};

export const deployDoubleTransferHelper = async (
  hre: HardhatRuntimeEnvironment,
  token: Address
): Promise<DoubleTransferHelper> => {
  const {
    deployments: {deploy},
    getNamedAccounts,
    network,
  } = hre;
  const {deployer} = await getNamedAccounts();
  const contract = ContractId.DoubleTransferHelper;
  const result = await deploy(contract, {
    from: deployer,
    contract,
    args: [token],
  });
  console.log(`${contract}:\t ${result.address}`);
  await registerContractInJsonDb(ContractType.Helper, contract, network.name, result);

  return await getContractAt(hre, contract, result.address);
};

export const deployMockAToken = async (
  hre: HardhatRuntimeEnvironment,
  name: ContractId,
  incentivesController: Address
): Promise<MockAToken> => {
  const {
    deployments: {deploy},
    getNamedAccounts,
    network,
  } = hre;
  const {deployer} = await getNamedAccounts();
  const contract = ContractId.MockAToken;
  const result = await deploy(name, {
    from: deployer,
    contract,
    args: [incentivesController],
  });
  console.log(`${contract}:\t ${result.address}`);
  await registerContractInJsonDb(ContractType.MockAToken, name, network.name, result);

  return await getContractAt(hre, contract, result.address);
};
