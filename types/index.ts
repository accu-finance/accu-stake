import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/dist/src/signers';
import {BigNumberish} from 'ethers';
import {
  IncentivesController,
  InitializableAdminUpgradeabilityProxy,
  MockAToken,
  MockMintableERC20,
  StakedAccu,
} from '../typechain';

export enum ContractId {
  accuToken = 'accuToken',
  StakedAccu = 'StakedAccu',
  InitializableAdminUpgradeabilityProxy = 'InitializableAdminUpgradeabilityProxy',
  DistributionManager = 'DistributionManager',
  IncentivesController = 'IncentivesController',
  StakedAccuProxy = 'StakedAccuProxy',
  IncentivesControllerProxy = 'IncentivesControllerProxy',
  MockADAI = 'MockADAI',
  MockAETH = 'MockAETH',
  MockAToken = 'MockAToken',
  MockStakedAccuV2 = 'MockStakedAccuV2',
  MockAccuTokenV2 = 'MockAccuTokenV2',
  MockDoubleTransfer = 'MockDoubleTransfer',
  MockMintableERC20 = 'MockMintableERC20',
}

export enum Network {
  hardhat = 'hardhat',
  localhost = 'localhost',
  kovan = 'kovan',
  mainnet = 'mainnet',
  ropsten = 'ropsten',
  tenderlyMain = 'tenderlyMain',
  bsctestnet = 'bsctestnet',
  bscmainnet = 'bscmainnet',
}

export type Address = string;

export type BaseNetworkConfig<T> = Record<Network, T>;

export type NetworkConfig<T> = BaseNetworkConfig<T>;

export interface BaseConfiguration {
  accuAdmin: NetworkConfig<Address>;
  distributer: NetworkConfig<Address>;
}

export type Configuration = BaseConfiguration;

export enum ChainId {
  // MAINNET = 1,
  // ROPSTEN = 3,
  // RINKEBY = 4,
  // GÖRLI = 5,
  // KOVAN = 42,
  // BSC_MAINNET = 56,
  bscTestnet = 97,
  hardhat = 31337,
  localhost = 31337,
}

export enum DelegationType {
  VOTING_POWER,
  PROPOSITION_POWER,
}

export type ContractRecord = {
  accuToken: MockMintableERC20;
  stakedAccu: StakedAccu;
  stakedAccuProxy: InitializableAdminUpgradeabilityProxy;
  incentivesController: IncentivesController;
  incentivesControllerProxy: InitializableAdminUpgradeabilityProxy;
  mockADAI: MockAToken;
  mockAETH: MockAToken;
};

export type User = {
  address: string;
  name: string;
  signer: SignerWithAddress;
} & ContractRecord;

export type Fixture = {
  deployer: User;
  admin: User;
  distributer: User;
  emissionManager: User;
  rewardsVault: User;
  user1: User;
  user2: User;
  user3: User;
  user4: User;
  user5: User;
  chainId: number;
} & ContractRecord;

export type DbSchema = Record<ContractId, ContractDeployResult>;

export interface ContractDeployResult {
  network: string;
  address: string;
  deployer: string;
}

export type AssetConfigInput = {
  emissionPerSecond: BigNumberish;
  totalStaked: BigNumberish;
  underlyingAsset: Address;
};

export type UserStakeInput = {
  stakedByUser: BigNumberish;
  totalStaked: BigNumberish;
  underlyingAsset: Address;
};
