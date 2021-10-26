import {waffleChai} from '@ethereum-waffle/chai';
import {expect, use} from 'chai';
import {BigNumber, constants, utils} from 'ethers';
import {HOUR, SECOND} from '../constants';
import {AssetConfigInput, Fixture} from '../types';
import {advanceTimeAndBlock, getLatestBlockTimestamp} from '../utils/hhNetwork';
import setupFixture from '../utils/setupFixture';
import {getRewards, getUserIndex, stakeToken} from './helpers';

const {Zero, MaxUint256} = constants;

use(waffleChai);

describe('StakedToken Basics', () => {
  const fixture = {} as Fixture;

  before(async () => {
    Object.assign(fixture, await setupFixture());
    const {stakedAccu, rewardsVault} = fixture;

    // mint accu to contract as rewards
    await rewardsVault.accuToken.mint(utils.parseEther('1000000000'));
    await rewardsVault.accuToken.approve(stakedAccu.address, MaxUint256);
  });

  it('check if initial configuration after initialize() is correct', async () => {
    const {stakedAccu, accuToken, rewardsVault} = fixture;

    expect(await stakedAccu.name()).to.be.equal('Staked Accu');
    expect(await stakedAccu.symbol()).to.be.equal('stkACCU');
    expect(await stakedAccu.decimals()).to.be.equal(18);
    expect(await stakedAccu.REVISION()).to.be.equal(1);
    expect(await stakedAccu.STAKED_TOKEN()).to.be.equal(accuToken.address);
    expect(await stakedAccu.REWARD_TOKEN()).to.be.equal(accuToken.address);
    expect(await stakedAccu.COOLDOWN_SECONDS()).to.be.equal(24 * HOUR);
    expect(await stakedAccu.UNSTAKE_WINDOW()).to.be.equal(48 * HOUR);
    expect(await stakedAccu.REWARDS_VAULT()).to.be.equal(rewardsVault.address);
  });

  it('reverted: try to stake 0 amount', async () => {
    const {user1} = fixture;

    await expect(user1.stakedAccu.stake(user1.address, Zero)).to.be.revertedWith('INVALID_ZERO_AMOUNT');
  });

  it('reverted: try to activate cooldown with 0 staked amount', async () => {
    const {user1} = fixture;

    await expect(user1.stakedAccu.cooldown()).to.be.revertedWith('INVALID_BALANCE_ON_COOLDOWN');
  });

  it('User 1 stakes 50 ACCU: receives 50 SACCU, StakedAave balance of ACCU is 50 and his rewards to claim are 0', async () => {
    const {accuToken, stakedAccu, user1, emissionManager} = fixture;

    const amount = utils.parseEther('50');
    await user1.accuToken.mint(amount);
    await user1.accuToken.approve(stakedAccu.address, MaxUint256);

    const emissionPerSecond = 100;
    const totalStaked = await stakedAccu.totalSupply();
    const underlyingAsset = stakedAccu.address;
    const input: AssetConfigInput[] = [
      {
        emissionPerSecond,
        totalStaked,
        underlyingAsset,
      },
    ];
    const tx = await emissionManager.stakedAccu.configureAssets(input);
    await expect(Promise.resolve(tx))
      .to.emit(stakedAccu, 'AssetConfigUpdated')
      .withArgs(underlyingAsset, emissionPerSecond);

    const userStakedBalanceBefore = await stakedAccu.balanceOf(user1.address);
    const userTokenBalanceBefore = await accuToken.balanceOf(user1.address);
    const contractTokenBalanceBefore = await accuToken.balanceOf(stakedAccu.address);

    await stakeToken(stakedAccu, user1, user1, amount, {shouldReward: false, timeTravel: 100 * SECOND});

    const userStakedBalanceAfter = await stakedAccu.balanceOf(user1.address);
    const userTokenBalanceAfter = await accuToken.balanceOf(user1.address);
    const contractTokenBalanceAfter = await accuToken.balanceOf(stakedAccu.address);

    expect(userStakedBalanceAfter).to.be.equal(userStakedBalanceBefore.add(amount), 'user staked balance');
    expect(contractTokenBalanceAfter).to.be.equal(contractTokenBalanceBefore.add(amount), 'contract token balance');
    expect(userTokenBalanceAfter).to.be.equal(userTokenBalanceBefore.sub(amount), 'user token balance');
  });

  it('user1 stakes 20 ACCU more: his total SACCU balance increases, StakedAave balance of Aave increases and his reward until now get accumulated', async () => {
    const {accuToken, stakedAccu, user1} = fixture;

    const amount = utils.parseEther('20');
    await user1.accuToken.mint(amount);

    const userStakedBalanceBefore = await stakedAccu.balanceOf(user1.address);
    const userTokenBalanceBefore = await accuToken.balanceOf(user1.address);
    const contractTokenBalanceBefore = await accuToken.balanceOf(stakedAccu.address);

    await stakeToken(stakedAccu, user1, user1, amount, {shouldReward: true, timeTravel: 100 * SECOND});

    const userStakedBalanceAfter = await stakedAccu.balanceOf(user1.address);
    const userTokenBalanceAfter = await accuToken.balanceOf(user1.address);
    const contractTokenBalanceAfter = await accuToken.balanceOf(stakedAccu.address);

    expect(userStakedBalanceAfter).to.be.equal(userStakedBalanceBefore.add(amount), 'user staked balance');
    expect(contractTokenBalanceAfter).to.be.equal(contractTokenBalanceBefore.add(amount), 'contract token balance');
    expect(userTokenBalanceAfter).to.be.equal(userTokenBalanceBefore.sub(amount), 'user token balance');
  });

  it('user1 claims half of rewards', async () => {
    const {accuToken, stakedAccu, user1} = fixture;

    const userTokenBalanceBefore = await accuToken.balanceOf(user1.address);

    const totalRewards = await stakedAccu.stakerRewardsToClaim(user1.address);
    const amountToClaim = totalRewards.div(2);
    const tx = await user1.stakedAccu.claimRewards(user1.address, amountToClaim);

    await expect(Promise.resolve(tx))
      .to.emit(stakedAccu, 'RewardsClaimed')
      .withArgs(user1.address, user1.address, amountToClaim);

    const userTokenBalanceAfter = await accuToken.balanceOf(user1.address);
    expect(userTokenBalanceAfter).to.be.eq(userTokenBalanceBefore.add(amountToClaim));
  });

  it('reverted: user1 claims higher rewards than the current balance ', async () => {
    const {accuToken, stakedAccu, user1} = fixture;

    const userTokenBalanceBefore = await accuToken.balanceOf(user1.address);

    const totalRewards = await stakedAccu.stakerRewardsToClaim(user1.address);
    const amountToClaim = totalRewards.mul(2);
    await expect(user1.stakedAccu.claimRewards(user1.address, amountToClaim)).to.be.revertedWith('INVALID_AMOUNT');

    const userTokenBalanceAfter = await accuToken.balanceOf(user1.address);
    expect(userTokenBalanceAfter).to.be.eq(userTokenBalanceBefore);
  });

  it('user1 claims all of rewards', async () => {
    const {accuToken, stakedAccu, user1} = fixture;

    const underlyingAsset = stakedAccu.address;
    const userTokenBalanceBefore = await accuToken.balanceOf(user1.address);
    const userStakedBalanceBefore = await stakedAccu.balanceOf(user1.address);
    const userIndexBefore = await getUserIndex(stakedAccu, user1.address, underlyingAsset);

    const totalRewards = await stakedAccu.stakerRewardsToClaim(user1.address);
    const amountToClaim = MaxUint256;
    const tx = await user1.stakedAccu.claimRewards(user1.address, amountToClaim);

    const userIndexAfter = await getUserIndex(stakedAccu, user1.address, underlyingAsset);

    const expectedAccruedRewards = getRewards(userStakedBalanceBefore, userIndexAfter, userIndexBefore);

    await expect(Promise.resolve(tx))
      .to.emit(stakedAccu, 'RewardsClaimed')
      .withArgs(user1.address, user1.address, expectedAccruedRewards.add(totalRewards));

    const userTokenBalanceAfter = await accuToken.balanceOf(user1.address);

    expect(userTokenBalanceAfter).to.be.eq(userTokenBalanceBefore.add(expectedAccruedRewards).add(totalRewards));
  });

  it('user2 stakes 50 ACCU, with the rewards not enabled', async () => {
    const {accuToken, stakedAccu, user2, emissionManager} = fixture;

    const amount = utils.parseEther('50');
    await user2.accuToken.mint(amount);
    await user2.accuToken.approve(stakedAccu.address, MaxUint256);

    const emissionPerSecond = Zero;
    const totalStaked = Zero;
    const underlyingAsset = stakedAccu.address;
    const input: AssetConfigInput[] = [
      {
        emissionPerSecond,
        totalStaked,
        underlyingAsset,
      },
    ];
    const tx = await emissionManager.stakedAccu.configureAssets(input);
    await expect(Promise.resolve(tx))
      .to.emit(stakedAccu, 'AssetConfigUpdated')
      .withArgs(underlyingAsset, emissionPerSecond);

    const userStakedBalanceBefore = await stakedAccu.balanceOf(user2.address);
    const userTokenBalanceBefore = await accuToken.balanceOf(user2.address);
    const contractTokenBalanceBefore = await accuToken.balanceOf(stakedAccu.address);

    await stakeToken(stakedAccu, user2, user2, amount, {shouldReward: false, timeTravel: 100 * SECOND});

    expect(await stakedAccu.getTotalRewardsBalance(user2.address)).to.be.eq(Zero);

    const userStakedBalanceAfter = await stakedAccu.balanceOf(user2.address);
    const userTokenBalanceAfter = await accuToken.balanceOf(user2.address);
    const contractTokenBalanceAfter = await accuToken.balanceOf(stakedAccu.address);

    expect(userStakedBalanceAfter).to.be.equal(userStakedBalanceBefore.add(amount), 'user staked balance');
    expect(contractTokenBalanceAfter).to.be.equal(contractTokenBalanceBefore.add(amount), 'contract token balance');
    expect(userTokenBalanceAfter).to.be.equal(userTokenBalanceBefore.sub(amount), 'user token balance');
  });

  it('User 6 stakes 30 ACCU more, with the rewards not enabled', async () => {
    const {accuToken, stakedAccu, user2} = fixture;

    const amount = utils.parseEther('30');
    await user2.accuToken.mint(amount);

    const userStakedBalanceBefore = await stakedAccu.balanceOf(user2.address);
    const userTokenBalanceBefore = await accuToken.balanceOf(user2.address);
    const contractTokenBalanceBefore = await accuToken.balanceOf(stakedAccu.address);

    await stakeToken(stakedAccu, user2, user2, amount, {shouldReward: false, timeTravel: 100 * SECOND});

    expect(await stakedAccu.getTotalRewardsBalance(user2.address)).to.be.eq(Zero);

    const userStakedBalanceAfter = await stakedAccu.balanceOf(user2.address);
    const userTokenBalanceAfter = await accuToken.balanceOf(user2.address);
    const contractTokenBalanceAfter = await accuToken.balanceOf(stakedAccu.address);

    expect(userStakedBalanceAfter).to.be.equal(userStakedBalanceBefore.add(amount), 'user staked balance');
    expect(contractTokenBalanceAfter).to.be.equal(contractTokenBalanceBefore.add(amount), 'contract token balance');
    expect(userTokenBalanceAfter).to.be.equal(userTokenBalanceBefore.sub(amount), 'user token balance');
  });

  it('check staker cooldown with stake() while being on valid unstake window', async () => {
    const {stakedAccu, user3} = fixture;
    const amount1 = utils.parseEther('50');
    const amount2 = utils.parseEther('20');

    const COOLDOWN_SECONDS = await stakedAccu.COOLDOWN_SECONDS();
    await user3.accuToken.mint(amount1.add(amount2));
    await user3.accuToken.approve(stakedAccu.address, MaxUint256);

    await stakeToken(stakedAccu, user3, user3, amount1, {shouldReward: false, timeTravel: 100 * SECOND});

    await expect(user3.stakedAccu.redeem(user3.address, MaxUint256)).to.be.revertedWith('UNSTAKE_WINDOW_FINISHED');

    await user3.stakedAccu.cooldown();
    const cooldownTimestampBefore = await stakedAccu.stakersCooldowns(user3.address);
    let latestTimestamp = await getLatestBlockTimestamp();

    expect(cooldownTimestampBefore).to.be.eq(BigNumber.from(latestTimestamp));

    await advanceTimeAndBlock(COOLDOWN_SECONDS.toNumber());

    await user3.stakedAccu.stake(user3.address, amount2);
    const cooldownTimestampAfter = await stakedAccu.stakersCooldowns(user3.address);

    latestTimestamp = await getLatestBlockTimestamp();

    const expectedCooldownTimestamp = amount2
      .mul(latestTimestamp)
      .add(amount1.mul(cooldownTimestampBefore))
      .div(amount2.add(amount1));

    expect(cooldownTimestampAfter).to.be.eq(expectedCooldownTimestamp);
  });
});
