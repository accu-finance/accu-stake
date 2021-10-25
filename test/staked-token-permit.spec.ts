import {waffleChai} from '@ethereum-waffle/chai';
import {TypedDataDomain} from '@ethersproject/abstract-signer';
import {_TypedDataEncoder} from '@ethersproject/hash';
import {expect, use} from 'chai';
import {BigNumber, constants, utils} from 'ethers';
import hre from 'hardhat';
import {HOUR, YEAR} from '../constants';
import {Fixture} from '../types';
import {deployMockStakedAccuV2} from '../utils/contractDeployer';
import setupFixture from '../utils/setupFixture';

const {Zero, MaxUint256, AddressZero} = constants;

use(waffleChai);

describe('StakedToken Permit', () => {
  const fixture = {} as Fixture;
  let domain: TypedDataDomain;
  const permitTypes = {
    Permit: [
      {name: 'owner', type: 'address'},
      {name: 'spender', type: 'address'},
      {name: 'value', type: 'uint256'},
      {name: 'nonce', type: 'uint256'},
      {name: 'deadline', type: 'uint256'},
    ],
  };

  before(async () => {
    Object.assign(fixture, await setupFixture());
    const {chainId, stakedAccu} = fixture;
    domain = {
      name: 'Staked Accu',
      version: '1',
      chainId: chainId,
      verifyingContract: stakedAccu.address,
    };
  });

  it('Checks the domain separator', async () => {
    const {stakedAccu, chainId} = fixture;
    const EIP712_DOMAIN = utils.keccak256(
      utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
    );
    const NAME = utils.keccak256(utils.toUtf8Bytes('Staked Accu'));
    const EIP712_REVISION = utils.keccak256(utils.toUtf8Bytes('1'));

    //need to pad address https://ethereum.stackexchange.com/questions/96697/soliditys-keccak256-hash-doesnt-match-web3-keccak-hash
    const DOMAIN_SEPARATOR_ENCODED = utils.solidityKeccak256(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'bytes32'],
      [EIP712_DOMAIN, NAME, EIP712_REVISION, chainId, utils.hexZeroPad(stakedAccu.address, 32)]
    );

    expect(await stakedAccu.DOMAIN_SEPARATOR()).to.be.equal(DOMAIN_SEPARATOR_ENCODED, 'Invalid domain separator');

    const domainSeparator = _TypedDataEncoder.hashDomain(domain);
    expect(await stakedAccu.DOMAIN_SEPARATOR()).to.be.equal(domainSeparator, 'Invalid domain separator');
  });

  it('Checks the revision', async () => {
    const {stakedAccu} = fixture;

    expect((await stakedAccu.REVISION()).toString()).to.be.equal('1', 'Invalid revision');
  });

  it('Reverts submitting a permit with 0 expiration', async () => {
    const {stakedAccu, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;
    const deadline = Zero;
    const nonce = await stakedAccu._nonces(owner);
    const permitAmount = utils.parseEther('2');
    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    expect(await stakedAccu.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');
    await expect(user1.stakedAccu.permit(owner, spender, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_EXPIRATION'
    );
    expect(await stakedAccu.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_AFTER_PERMIT');
  });

  it('Submits a permit with maximum expiration length', async () => {
    const {stakedAccu, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;
    const expiration = MaxUint256;
    const nonce = await stakedAccu._nonces(owner);
    const permitAmount = utils.parseEther('2').toString();
    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline: expiration,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    expect(await stakedAccu.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');
    await expect(user1.stakedAccu.permit(owner, spender, permitAmount, expiration, v, r, s)).not.to.be.reverted;
    expect(await stakedAccu.allowance(owner, spender)).to.be.equal(permitAmount, 'INVALID_ALLOWANCE_AFTER_PERMIT');
    expect(await stakedAccu._nonces(owner)).to.be.equal(BigNumber.from(1));
  });

  it('Cancels the previous permit', async () => {
    const {stakedAccu, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;
    const expiration = MaxUint256;
    const nonce = await stakedAccu._nonces(owner);
    const permitAmount = Zero;
    const prevPermitAmount = utils.parseEther('2');
    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline: expiration,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    expect(await stakedAccu.allowance(owner, spender)).to.be.equal(prevPermitAmount, 'INVALID_ALLOWANCE_BEFORE_PERMIT');
    await expect(user1.stakedAccu.permit(owner, spender, permitAmount, expiration, v, r, s)).not.to.be.reverted;
    expect(await stakedAccu.allowance(owner, spender)).to.be.equal(permitAmount, 'INVALID_ALLOWANCE_AFTER_PERMIT');
    expect(await stakedAccu._nonces(owner)).to.be.equal(BigNumber.from(2));
  });

  it('Tries to submit a permit with invalid nonce', async () => {
    const {stakedAccu, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;
    const deadline = MaxUint256;
    const nonce = BigNumber.from(1000);
    const permitAmount = utils.parseEther('2');
    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    expect(await stakedAccu.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');
    await expect(user1.stakedAccu.permit(owner, spender, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_SIGNATURE'
    );
  });

  it('Tries to submit a permit with invalid expiration (previous to the current block)', async () => {
    const {stakedAccu, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;
    const deadline = BigNumber.from(1);
    const nonce = await stakedAccu._nonces(owner);
    const permitAmount = utils.parseEther('2');
    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    expect(await stakedAccu.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');
    await expect(user1.stakedAccu.permit(owner, spender, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_EXPIRATION'
    );
  });

  it('Tries to submit a permit with invalid signature', async () => {
    const {stakedAccu, deployer, user1, user2} = fixture;
    const owner = deployer.address;
    const spender = user1.address;
    const deadline = MaxUint256;
    const nonce = await stakedAccu._nonces(owner);
    const permitAmount = utils.parseEther('2');
    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    expect(await stakedAccu.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');
    await expect(user1.stakedAccu.permit(owner, AddressZero, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_SIGNATURE'
    );
    await expect(user1.stakedAccu.permit(owner, user2.address, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_SIGNATURE'
    );
    await expect(user1.stakedAccu.permit(user2.address, spender, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_SIGNATURE'
    );
  });

  it('Tries to submit a permit with invalid owner', async () => {
    const {stakedAccu, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;
    const deadline = MaxUint256;
    const nonce = await stakedAccu._nonces(owner);
    const permitAmount = utils.parseEther('2');
    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    expect(await stakedAccu.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');
    await expect(user1.stakedAccu.permit(AddressZero, spender, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_OWNER'
    );
  });

  it('Checks the total supply', async () => {
    const {stakedAccu} = fixture;
    const totalSupply = await stakedAccu.totalSupply();
    expect(totalSupply).equal(Zero);
  });

  it('Updates the implementation of the Accu token to V2', async () => {
    const {admin, stakedAccu, rewardsVault, emissionManager} = fixture;

    const totalSupply = await stakedAccu.totalSupply();

    const mockTokenV2 = await deployMockStakedAccuV2(hre, [
      stakedAccu.address,
      stakedAccu.address,
      24 * HOUR,
      48 * HOUR,
      rewardsVault.address,
      emissionManager.address,
      100 * YEAR,
      AddressZero,
    ]);

    const encodedIntialize = mockTokenV2.interface.encodeFunctionData('initialize');

    await admin.stakedAccuProxy.upgradeToAndCall(mockTokenV2.address, encodedIntialize);

    expect((await stakedAccu.REVISION()).toString()).to.be.equal('2', 'Invalid revision');
    expect(await stakedAccu.name()).to.be.equal('Staked Accu', 'Invalid token name');
    expect(await stakedAccu.symbol()).to.be.equal('stkACCU', 'Invalid token symbol');
    expect((await stakedAccu.decimals()).toString()).to.be.equal('18', 'Invalid token decimals');
    expect(await stakedAccu.totalSupply()).to.be.equal(totalSupply, 'New version should not mint new token');
  });
});
