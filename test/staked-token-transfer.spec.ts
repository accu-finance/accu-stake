import {waffleChai} from '@ethereum-waffle/chai';
import {expect, use} from 'chai';
import {BigNumber, constants, utils} from 'ethers';
import {SECOND} from '../constants';
import {StakedAccu} from '../typechain';
import {Address, AssetConfigInput, Fixture, User} from '../types';
import {advanceTimeAndBlock, getLatestBlockTimestamp} from '../utils/hhNetwork';
import setupFixture from '../utils/setupFixture';
import {stakeToken, transferStakedToken} from './helpers';

const {Zero, MaxUint256} = constants;

use(waffleChai);

describe('StakedToken Transfer', () => {
  const fixture = {} as Fixture;
  let COOLDOWN_SECONDS: BigNumber;
  let UNSTAKE_WINDOW: BigNumber;
  let underlyingAsset: Address;

  before(async () => {
    Object.assign(fixture, await setupFixture());
    const {stakedAccu, rewardsVault} = fixture;

    underlyingAsset = stakedAccu.address;

    COOLDOWN_SECONDS = await stakedAccu.COOLDOWN_SECONDS();
    UNSTAKE_WINDOW = await stakedAccu.UNSTAKE_WINDOW();

    // mint ACCU to contract as rewards
    await rewardsVault.accuToken.mint(utils.parseEther('1000000000'));
    await rewardsVault.accuToken.approve(stakedAccu.address, MaxUint256);
  });

  const configureNonZeroEmission = async (emissionManager: User, stakedAccu: StakedAccu) => {
    const emissionPerSecond = 100;
    const totalStaked = await stakedAccu.totalSupply();
    const input: AssetConfigInput[] = [
      {
        emissionPerSecond,
        totalStaked,
        underlyingAsset,
      },
    ];
    await emissionManager.stakedAccu.configureAssets(input);
  };

  const configureZeroEmission = async (emissionManager: User) => {
    const emissionPerSecond = Zero;
    const input: AssetConfigInput[] = [
      {
        emissionPerSecond,
        totalStaked: Zero,
        underlyingAsset,
      },
    ];
    await emissionManager.stakedAccu.configureAssets(input);
  };

  it('user1 stakes 50 ACCU', async () => {
    const {stakedAccu, user1, emissionManager} = fixture;

    await configureNonZeroEmission(emissionManager, stakedAccu);

    const amount = utils.parseEther('50');
    await user1.accuToken.mint(amount);
    await user1.accuToken.approve(stakedAccu.address, MaxUint256);

    await stakeToken(stakedAccu, user1, user1, amount, {shouldReward: false, timeTravel: 100 * SECOND});
  });

  it('user1 transfer 50 stkACCU to user2', async () => {
    const {stakedAccu, user1, user2, emissionManager} = fixture;

    await configureNonZeroEmission(emissionManager, stakedAccu);

    const amount = utils.parseEther('50');

    await transferStakedToken(stakedAccu, user1, user2, amount, {
      shouldSenderReward: true,
      shouldRecieverReward: false,
      timeTravel: 100 * SECOND,
    });
  });

  it('user2 transfer 50 stkACCU to himself', async () => {
    const {stakedAccu, user2, emissionManager} = fixture;

    await configureNonZeroEmission(emissionManager, stakedAccu);

    const amount = utils.parseEther('50');

    await transferStakedToken(stakedAccu, user2, user2, amount, {
      shouldRecieverReward: true,
      shouldSenderReward: true,
      timeTravel: 100 * SECOND,
    });
  });

  it('user2 transfers 50 stkACCU to user3, with rewards not enabled', async () => {
    const {stakedAccu, user2, user3, emissionManager} = fixture;

    await configureZeroEmission(emissionManager);

    const amount = utils.parseEther('50');

    await transferStakedToken(stakedAccu, user2, user3, amount, {
      shouldRecieverReward: false,
      shouldSenderReward: false,
      timeTravel: 100 * SECOND,
    });
  });

  it('user4 stakes and transfers 50 stkACCU to user3, with rewards not enabled', async () => {
    const {stakedAccu, user3, user4, emissionManager} = fixture;

    await configureZeroEmission(emissionManager);

    const amount = utils.parseEther('50');

    await user4.accuToken.mint(amount);
    await user4.accuToken.approve(stakedAccu.address, MaxUint256);

    await stakeToken(stakedAccu, user4, user4, amount, {shouldReward: false, timeTravel: 100 * SECOND});

    await transferStakedToken(stakedAccu, user4, user3, amount, {
      shouldRecieverReward: false,
      shouldSenderReward: false,
    });
  });

  it('sender activates cooldown, transfer all to reciever, sender cooldown should be reset if all amount get transfered', async () => {
    const {stakedAccu, user3: sender, user5: reciever, emissionManager} = fixture;

    await configureZeroEmission(emissionManager);

    const amount = utils.parseEther('100');

    await sender.stakedAccu.cooldown();
    const latestTimestamp = await getLatestBlockTimestamp();
    const cooldownTimestamp = await stakedAccu.stakersCooldowns(sender.address);
    expect(cooldownTimestamp).to.be.eq(latestTimestamp);

    await transferStakedToken(stakedAccu, sender, reciever, amount, {
      shouldRecieverReward: false,
      shouldSenderReward: false,
      timeTravel: 100 * SECOND,
    });

    expect(await stakedAccu.stakersCooldowns(sender.address)).to.be.eq(Zero);
    expect(await stakedAccu.balanceOf(sender.address)).to.be.eq(Zero);
    expect(await stakedAccu.balanceOf(reciever.address)).to.be.gt(Zero);
  });

  it('sender activates cooldown, transfer to reciever, reciever cooldown should be reset if sender cooldown gets expired', async () => {
    const {stakedAccu, user3: reciever, user5: sender, emissionManager} = fixture;

    await configureZeroEmission(emissionManager);

    const amount = utils.parseEther('10');

    await sender.stakedAccu.cooldown();

    await reciever.accuToken.approve(stakedAccu.address, MaxUint256);
    await reciever.accuToken.mint(amount);
    await reciever.stakedAccu.stake(reciever.address, amount);
    await reciever.stakedAccu.cooldown();

    await advanceTimeAndBlock(COOLDOWN_SECONDS.add(UNSTAKE_WINDOW).add(1).toNumber());

    // Transfer staked ACCU from sender to receiver, it will also transfer the cooldown status from sender to the receiver
    await transferStakedToken(stakedAccu, sender, reciever, amount, {
      shouldRecieverReward: false,
      shouldSenderReward: false,
      timeTravel: 100 * SECOND,
    });

    expect(await stakedAccu.stakersCooldowns(reciever.address)).to.be.eq(Zero);
    expect(await stakedAccu.balanceOf(sender.address)).to.be.gt(Zero);
    expect(await stakedAccu.balanceOf(reciever.address)).to.be.gt(Zero);
  });

  it('sender activates cooldown, transfer to reciever, reciever cooldown should be the same if sender cooldown is less than reciever cooldown', async () => {
    const {stakedAccu, user3: reciever, user5: sender, emissionManager} = fixture;

    await configureZeroEmission(emissionManager);

    const amount = utils.parseEther('10');

    await sender.stakedAccu.cooldown();
    await advanceTimeAndBlock(5 * SECOND);
    await reciever.stakedAccu.cooldown();
    const recieverCooldownBefore = await stakedAccu.stakersCooldowns(reciever.address);

    // Transfer staked ACCU from sender to receiver, it will also transfer the cooldown status from sender to the receiver
    await transferStakedToken(stakedAccu, sender, reciever, amount, {
      shouldRecieverReward: false,
      shouldSenderReward: false,
      timeTravel: 100 * SECOND,
    });

    const recieverCooldownAfter = await stakedAccu.stakersCooldowns(reciever.address);

    expect(recieverCooldownAfter).to.be.eq(recieverCooldownBefore);
    expect(await stakedAccu.balanceOf(sender.address)).to.be.gt(Zero);
    expect(await stakedAccu.balanceOf(reciever.address)).to.be.gt(Zero);
  });
});
