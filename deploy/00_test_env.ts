import {constants} from 'ethers';
import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {HOUR, PSM_STAKER_PREMIUM, YEAR} from '../constants';
import {ContractId} from '../types';
import {parseNetwork} from '../utils';
import {
  deployIncentivesController,
  deployInitializableAdminUpgradeabilityProxy,
  deployMockAToken,
  deployMockMintableERC20,
  deployStakedAccu,
} from '../utils/contractDeployer';
import {waitForTx} from '../utils/hhNetwork';

const {AddressZero} = constants;

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const {network} = parseNetwork(hre.network.name);
  console.log(`***** using network ${network}  *****`);

  const {getNamedAccounts} = hre;
  const {admin, emissionManager, rewardsVault} = await getNamedAccounts();

  const accuToken = await deployMockMintableERC20(hre, 'Accu Token', 'ACCU');
  const stakedAccuImpl = await deployStakedAccu(hre, [
    accuToken.address,
    accuToken.address,
    24 * HOUR,
    48 * HOUR,
    rewardsVault,
    emissionManager,
    100 * YEAR,
    AddressZero,
  ]);
  const stakedAccuProxy = await deployInitializableAdminUpgradeabilityProxy(hre, ContractId.StakedAccuProxy);
  const encodedIntialize = stakedAccuImpl.interface.encodeFunctionData('initialize');
  await waitForTx(
    await stakedAccuProxy['initialize(address,address,bytes)'](stakedAccuImpl.address, admin, encodedIntialize)
  );

  const incentivesControllerImpl = await deployIncentivesController(hre, [
    accuToken.address,
    rewardsVault,
    stakedAccuProxy.address,
    PSM_STAKER_PREMIUM,
    emissionManager,
    1 * YEAR,
  ]);
  const incentivesControllerProxy = await deployInitializableAdminUpgradeabilityProxy(
    hre,
    ContractId.IncentivesControllerProxy
  );
  const encodedIntializeIncentivesController = incentivesControllerImpl.interface.encodeFunctionData('initialize');
  await waitForTx(
    await incentivesControllerProxy['initialize(address,address,bytes)'](
      incentivesControllerImpl.address,
      admin,
      encodedIntializeIncentivesController
    )
  );

  await deployMockAToken(hre, ContractId.MockADAI, incentivesControllerProxy.address);
  await deployMockAToken(hre, ContractId.MockAETH, incentivesControllerProxy.address);
};

export default func;
func.tags = ['testEnv'];
