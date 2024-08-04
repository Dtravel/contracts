import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

import { shouldBehaveLikeERC721Booking, shouldBehaveLikeERC721Metadata } from './ERC721Booking.behavior';

async function fixture() {
  const [deployer, factoryOperator, treasury, host, ...otherAccounts] = await ethers.getSigners();

  const gasToken = await ethers.deployContract('ERC20Test', ['token1', 'TK1']);
  const fee = 0;

  const factory = await ethers.deployContract('Factory', [
    factoryOperator.address,
    treasury.address,
    gasToken.getAddress(),
    fee,
  ]);
  const factoryAddress = await factory.getAddress();

  const name = 'Nites in Mansion in Mars';
  const symbol = 'NT';
  const uri = 'http://ipfs.io/ipfs/NT/';

  const token = await ethers.deployContract('NiteToken', [
    host.address,
    factoryOperator.address,
    factoryAddress,
    name,
    symbol,
    uri,
  ]);

  return {
    deployer,
    factoryOperator,
    treasury,
    host,
    otherAccounts,
    factory,
    token,
    gasToken,
    fee,
    name,
    symbol,
    uri,
  };
}

describe('ERC721Booking', function () {
  beforeEach(async function () {
    Object.assign(this, await loadFixture(fixture));
  });

  shouldBehaveLikeERC721Booking();
  shouldBehaveLikeERC721Metadata();
});
