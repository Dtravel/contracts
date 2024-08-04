import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ZeroAddress } from 'ethers';
import { getRandomInt } from './utils/helpers';

describe('NiteToken', () => {
  async function deployNiteTokenFixture() {
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

  describe('Deployment', () => {
    it('revert if factory address is zero address', async () => {
      const { host, name, symbol, uri } = await loadFixture(deployNiteTokenFixture);

      const niteFactory = await ethers.getContractFactory('NiteToken');
      await expect(
        ethers.deployContract('NiteToken', [host.address, ZeroAddress, ZeroAddress, name, symbol, uri]),
      ).revertedWithCustomError(niteFactory, 'ZeroAddress');
    });

    it('token transfer approval must not be granted to the zero address operator.', async () => {
      const { host, factory, name, symbol, uri, factoryOperator } = await loadFixture(deployNiteTokenFixture);

      const nite = await ethers.deployContract('NiteToken', [
        host.address,
        ZeroAddress,
        factory.getAddress(),
        name,
        symbol,
        uri,
      ]);
      expect(await nite.isApprovedForAll(host.address, factoryOperator.address)).deep.equal(false);
    });

    it('pause token transfer by default', async () => {
      const { token } = await loadFixture(deployNiteTokenFixture);
      expect(await token.paused()).deep.equal(true);
    });

    it('host can transfer by default', async () => {
      const { token, host, otherAccounts } = await loadFixture(deployNiteTokenFixture);
      const to = otherAccounts[2].address;
      const tokenId = getRandomInt(1, 100);
      await expect(token.connect(host).transferFrom(host.address, to, tokenId))
        .emit(token, 'Transfer')
        .withArgs(host.address, to, tokenId);
    });

    it('factory operator can transfer by default', async () => {
      const { token, host, factoryOperator, otherAccounts } = await loadFixture(deployNiteTokenFixture);
      const to = otherAccounts[2].address;
      const tokenId = getRandomInt(1, 100);
      await expect(token.connect(factoryOperator).transferFrom(host.address, to, tokenId))
        .emit(token, 'Transfer')
        .withArgs(host.address, to, tokenId);
    });

    it('user can not transfer by default', async () => {
      const { token, host, otherAccounts } = await loadFixture(deployNiteTokenFixture);
      const to = otherAccounts[2];
      const tokenId = getRandomInt(1, 100);
      await expect(token.connect(host).transferFrom(host.address, to.address, tokenId))
        .emit(token, 'Transfer')
        .withArgs(host.address, to.address, tokenId);

      await expect(token.connect(to).transferFrom(to.address, host.address, tokenId)).revertedWithCustomError(
        token,
        'TransferWhilePaused',
      );
    });
  });

  describe('Host setting', () => {
    describe('setName', () => {
      it('host can set token name', async () => {
        const { host, token } = await loadFixture(deployNiteTokenFixture);
        const newName = 'New Nite in Venus';
        await token.connect(host).setName(newName);
        expect(await token.name()).deep.equal(newName);
      });

      it('revert if caller is not host', async () => {
        const { factoryOperator, token } = await loadFixture(deployNiteTokenFixture);
        const newName = 'New Nite in Venus';
        await expect(token.connect(factoryOperator).setName(newName)).revertedWithCustomError(token, 'OnlyHost');
      });
    });

    describe('setBaseURI', () => {
      it('host can set token base URI', async () => {
        const { host, token } = await loadFixture(deployNiteTokenFixture);
        const baseURI = 'https://api.example.com/v1/';
        await token.connect(host).setBaseURI(baseURI);
        expect(await token.baseTokenURI()).deep.equal(baseURI);
      });

      it('revert if caller is not host', async () => {
        const { factoryOperator, token } = await loadFixture(deployNiteTokenFixture);
        const baseURI = 'https://api.example.com/v1/';
        await expect(token.connect(factoryOperator).setBaseURI(baseURI)).revertedWithCustomError(token, 'OnlyHost');
      });
    });

    describe('Pause', () => {
      beforeEach(async function () {
        Object.assign(this, await loadFixture(deployNiteTokenFixture));
        await this.token.connect(this.host).unpause();
      });

      it('host can pause token transfers', async function () {
        await expect(this.token.connect(this.host).pause()).emit(this.token, 'Paused').withArgs(this.host.address);
      });

      it('revert if caller is not host', async function () {
        await expect(this.token.connect(this.otherAccounts[0]).pause()).revertedWithCustomError(this.token, 'OnlyHost');
      });
    });

    describe('Unpause', () => {
      it('host can unpause token transfers', async function () {
        const { host, token } = await loadFixture(deployNiteTokenFixture);
        await expect(token.connect(host).unpause()).emit(token, 'Unpaused').withArgs(host.address);
      });

      it('revert if caller is not host', async function () {
        const { otherAccounts, token } = await loadFixture(deployNiteTokenFixture);
        await expect(token.connect(otherAccounts[0]).unpause()).revertedWithCustomError(token, 'OnlyHost');
      });
    });

    describe('withdrawGasToken', () => {
      it('host can withdraw gas token', async () => {
        const { gasToken, token, host } = await loadFixture(deployNiteTokenFixture);
        await gasToken.mint(await token.getAddress(), 10000);

        expect(await gasToken.balanceOf(await token.getAddress())).deep.equal(10000);

        const tx = await token.connect(host).withdrawGasToken(host.address, 500);
        await expect(tx).emit(token, 'WithdrawGasToken').withArgs(host.address, 500);

        await expect(tx).changeTokenBalances(gasToken, [await token.getAddress(), host.address], [-500, 500]);
      });

      it('revert if caller is not host', async function () {
        const { otherAccounts, token } = await loadFixture(deployNiteTokenFixture);
        await expect(
          token.connect(otherAccounts[0]).withdrawGasToken(otherAccounts[1].address, 500),
        ).revertedWithCustomError(token, 'OnlyHost');
      });
    });
  });
});
