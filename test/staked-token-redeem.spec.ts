import {waffleChai} from '@ethereum-waffle/chai';
import {expect, use} from 'chai';
import {BigNumber, constants, utils} from 'ethers';
import {SECOND} from '../constants';
import {AssetConfigInput, Fixture} from '../types';
import {advanceTimeAndBlock} from '../utils/hhNetwork';
import setupFixture from '../utils/setupFixture';
import {stakeToken} from './helpers';

const {Zero, MaxUint256} = constants;

use(waffleChai);

describe('StakedToken Redeem', () => {
  const fixture = {} as Fixture;
  let COOLDOWN_SECONDS: BigNumber;
  let UNSTAKE_WINDOW: BigNumber;

  before(async () => {
    Object.assign(fixture, await setupFixture());
    const {stakedAccu, rewardsVault} = fixture;

    COOLDOWN_SECONDS = await stakedAccu.COOLDOWN_SECONDS();
    UNSTAKE_WINDOW = await stakedAccu.UNSTAKE_WINDOW();

    // mint accu to contract as rewards
    await rewardsVault.accuToken.mint(utils.parseEther('1000000000'));
    await rewardsVault.accuToken.approve(stakedAccu.address, MaxUint256);
  });

  it('reverted: try to redeem 0 amount', async () => {
    const {user1} = fixture;

    await expect(user1.stakedAccu.redeem(user1.address, Zero)).to.be.revertedWith('INVALID_ZERO_AMOUNT');
  });

  it('user1 stakes 50 ACCU', async () => {
    const {stakedAccu, user1, emissionManager} = fixture;

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
    await emissionManager.stakedAccu.configureAssets(input);

    await stakeToken(stakedAccu, user1, user1, amount, {shouldReward: false});
  });

  it('reverted: user1 try to redeem without activatign cooldown', async () => {
    const {user1} = fixture;

    const amount = utils.parseEther('50');

    await expect(user1.stakedAccu.redeem(user1.address, amount)).to.be.revertedWith('UNSTAKE_WINDOW_FINISHED');
  });

  it('reverted: user1 activates cooldown but should not redeem before the COOLDOWN_SECONDS period', async () => {
    const {user1} = fixture;

    const amount = utils.parseEther('50');

    await user1.stakedAccu.cooldown();

    await expect(user1.stakedAccu.redeem(user1.address, amount)).to.be.revertedWith('INSUFFICIENT_COOLDOWN');

    const offsetSeconds = 10;

    await advanceTimeAndBlock(COOLDOWN_SECONDS.sub(offsetSeconds).toNumber());

    await expect(user1.stakedAccu.redeem(user1.address, amount)).to.be.revertedWith('INSUFFICIENT_COOLDOWN');

    await advanceTimeAndBlock(UNSTAKE_WINDOW.add(offsetSeconds).toNumber());

    await expect(user1.stakedAccu.redeem(user1.address, amount)).to.be.revertedWith('UNSTAKE_WINDOW_FINISHED');
  });

  it('user1 activates the cooldown again, and tries to redeem a bigger amount that he has staked, receiving the balance', async () => {
    const {user1, accuToken, stakedAccu} = fixture;

    const amount = utils.parseEther('100');

    const userTokenBalanceBefore = await accuToken.balanceOf(user1.address);
    const userStakedBalanceBefore = await stakedAccu.balanceOf(user1.address);

    await user1.stakedAccu.cooldown();

    const offsetSeconds = 10;

    await advanceTimeAndBlock(COOLDOWN_SECONDS.add(offsetSeconds).toNumber());

    await expect(user1.stakedAccu.redeem(user1.address, amount)).not.to.be.reverted;

    const userTokenBalanceAfter = await accuToken.balanceOf(user1.address);
    const userStakedBalanceAfter = await stakedAccu.balanceOf(user1.address);

    expect(userTokenBalanceAfter.sub(userTokenBalanceBefore)).to.be.eq(
      userStakedBalanceBefore.sub(userStakedBalanceAfter)
    );

    expect(userStakedBalanceAfter).to.be.eq(Zero);
  });

  it('user1 activates the cooldown again, and redeems within the unstake period', async () => {
    const {user1, accuToken, stakedAccu} = fixture;

    const amount = utils.parseEther('50');

    await stakeToken(stakedAccu, user1, user1, amount, {shouldReward: false, timeTravel: 100 * SECOND});

    const userTokenBalanceBefore = await accuToken.balanceOf(user1.address);
    const userStakedBalanceBefore = await stakedAccu.balanceOf(user1.address);

    await user1.stakedAccu.cooldown();

    const offsetSeconds = 10;

    await advanceTimeAndBlock(COOLDOWN_SECONDS.add(offsetSeconds).toNumber());

    await expect(user1.stakedAccu.redeem(user1.address, amount)).not.to.be.reverted;

    const userTokenBalanceAfter = await accuToken.balanceOf(user1.address);
    const userStakedBalanceAfter = await stakedAccu.balanceOf(user1.address);

    expect(userTokenBalanceAfter.sub(userTokenBalanceBefore)).to.be.eq(
      userStakedBalanceBefore.sub(userStakedBalanceAfter)
    );

    expect(userStakedBalanceAfter).to.be.eq(Zero);
  });

  it('user2 activates the cooldown again, and redeems half of the amount', async () => {
    const {user2, accuToken, stakedAccu} = fixture;

    const amount = utils.parseEther('50');
    await user2.accuToken.mint(amount);
    await user2.accuToken.approve(stakedAccu.address, MaxUint256);

    await stakeToken(stakedAccu, user2, user2, amount, {shouldReward: false, timeTravel: 100 * SECOND});

    const userTokenBalanceBefore = await accuToken.balanceOf(user2.address);
    const userStakedBalanceBefore = await stakedAccu.balanceOf(user2.address);

    await user2.stakedAccu.cooldown();

    const offsetSeconds = 10;

    await advanceTimeAndBlock(COOLDOWN_SECONDS.add(offsetSeconds).toNumber());

    await expect(user2.stakedAccu.redeem(user2.address, amount.div(2))).not.to.be.reverted;

    const userTokenBalanceAfter = await accuToken.balanceOf(user2.address);
    const userStakedBalanceAfter = await stakedAccu.balanceOf(user2.address);

    expect(userTokenBalanceAfter.sub(userTokenBalanceBefore)).to.be.eq(userStakedBalanceBefore.sub(amount.div(2)));
    expect(userStakedBalanceAfter).to.be.eq(amount.div(2));
  });
});
