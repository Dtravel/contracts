import { ethers, network } from 'hardhat';
import { expect } from 'chai';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { ZeroAddress } from 'ethers';
import { getRandomInt } from './utils/helpers';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { NiteToken } from '../typechain-types';

describe('NiteToken', () => {
  // typed data hash for eip-712
  const domain = {
    name: 'DtravelNT',
    version: '1',
    chainId: network.config.chainId,
    verifyingContract: '',
  };

  const permitTypes = {
    Permit: [
      { name: 'spender', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  };

  const permitForAllTypes = {
    PermitForAll: [
      { name: 'owner', type: 'address' },
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  };

  const min = 3600;
  const firstTokenId = 5042n;
  const secondTokenId = 79217n;
  const fourthTokenId = 4n;

  const generateSignature = async function (
    tokenContract: NiteToken,
    owner: SignerWithAddress,
    spender: string,
    tokenId: bigint,
    deadline: number,
    nonce?: bigint,
  ): Promise<string> {
    nonce ??= await tokenContract.sigNonces(owner.address);
    const data = {
      spender,
      tokenId,
      nonce,
      deadline,
    };

    // update domain part
    domain.verifyingContract = await tokenContract.getAddress();

    // return signature
    return owner.signTypedData(domain, permitTypes, data);
  };

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

  describe('Permit', () => {
    describe('by host', () => {
      it('should permit', async () => {
        const { token, host, otherAccounts } = await loadFixture(deployNiteTokenFixture);
        const deadline = (await time.latest()) + 1 * min;
        const spender = otherAccounts[0];

        // generate signature
        const sigs = await generateSignature(token, host, spender.address, firstTokenId, deadline);

        await expect(token.connect(host).permit(spender, firstTokenId, deadline, sigs))
          .emit(token, 'Approval')
          .withArgs(host.address, spender.address, firstTokenId);

        // spender can transfer now
        await token.connect(host).unpause();

        const to = otherAccounts[2];
        await expect(
          token.connect(spender)['safeTransferFrom(address,address,uint256)'](host.address, to.address, firstTokenId),
        )
          .emit(token, 'Transfer')
          .withArgs(host.address, to.address, firstTokenId);
      });

      it('transfer with permit', async () => {
        const { token, host, otherAccounts } = await loadFixture(deployNiteTokenFixture);
        const deadline = (await time.latest()) + 1 * min;
        const spender = otherAccounts[0];

        // spender can transfer with permit now
        await token.connect(host).unpause();

        // generate signature
        const sigs = await generateSignature(token, host, spender.address, firstTokenId, deadline);

        const to = otherAccounts[2];
        const tx = await token.connect(spender).transferWithPermit(to.address, firstTokenId, deadline, sigs);

        await expect(tx).emit(token, 'Approval').withArgs(host.address, spender.address, firstTokenId);
        await expect(tx).emit(token, 'Transfer').withArgs(host.address, to.address, firstTokenId);
      });

      it('revert if spender is the owner', async () => {
        const { token, host } = await loadFixture(deployNiteTokenFixture);
        const deadline = (await time.latest()) + 1 * min;
        const spender = host;

        // generate signature
        const sigs = await generateSignature(token, host, spender.address, firstTokenId, deadline);

        await expect(token.connect(host).permit(host, firstTokenId, deadline, sigs)).revertedWithCustomError(
          token,
          'ApprovalToCurrentOwner',
        );
      });

      describe('validate sigature', () => {
        it('revert if the permit has expired', async () => {
          const { token, host, otherAccounts } = await loadFixture(deployNiteTokenFixture);
          const deadline = (await time.latest()) - 1 * min;
          const spender = otherAccounts[0];

          // generate signature
          const sigs = await generateSignature(token, host, spender.address, firstTokenId, deadline);

          await expect(token.connect(host).permit(spender, firstTokenId, deadline, sigs)).revertedWithCustomError(
            token,
            'PermitExpired',
          );
        });

        it('revert if caller does match with sig', async () => {
          const { token, host, otherAccounts } = await loadFixture(deployNiteTokenFixture);
          const deadline = (await time.latest()) + 1 * min;
          const spender = otherAccounts[0];

          // generate signature
          const sigs = await generateSignature(token, spender, spender.address, firstTokenId, deadline);

          await expect(token.connect(host).permit(spender, firstTokenId, deadline, sigs)).revertedWithCustomError(
            token,
            'InvalidPermitSignature',
          );
        });

        it('revert if spender param does match with sig', async () => {
          const { token, host, otherAccounts } = await loadFixture(deployNiteTokenFixture);
          const deadline = (await time.latest()) + 1 * min;
          const spender = otherAccounts[0];

          // generate signature
          const sigs = await generateSignature(token, host, otherAccounts[1].address, firstTokenId, deadline);

          await expect(token.connect(host).permit(spender, firstTokenId, deadline, sigs)).revertedWithCustomError(
            token,
            'InvalidPermitSignature',
          );
        });

        it('revert if tokenId param does match with sig', async () => {
          const { token, host, otherAccounts } = await loadFixture(deployNiteTokenFixture);
          const deadline = (await time.latest()) + 1 * min;
          const spender = otherAccounts[0];

          // generate signature
          const sigs = await generateSignature(token, host, spender.address, firstTokenId, deadline);

          await expect(token.connect(host).permit(spender, secondTokenId, deadline, sigs)).revertedWithCustomError(
            token,
            'InvalidPermitSignature',
          );
        });

        it('revert if deadline param does match with sig', async () => {
          const { token, host, otherAccounts } = await loadFixture(deployNiteTokenFixture);
          const deadline = (await time.latest()) + 1 * min;
          const spender = otherAccounts[0];

          // generate signature
          const sigs = await generateSignature(token, host, spender.address, firstTokenId, deadline);

          await expect(
            token.connect(host).permit(spender, firstTokenId, deadline + 2 * min, sigs),
          ).revertedWithCustomError(token, 'InvalidPermitSignature');
        });

        it('revert if nonce param does match with sig', async () => {
          const { token, host, otherAccounts } = await loadFixture(deployNiteTokenFixture);
          const deadline = (await time.latest()) + 1 * min;
          const spender = otherAccounts[0];

          // generate signature
          const sigs = await generateSignature(token, host, spender.address, firstTokenId, deadline, 2n);

          await expect(token.connect(host).permit(spender, firstTokenId, deadline, sigs)).revertedWithCustomError(
            token,
            'InvalidPermitSignature',
          );
        });

        it('revert if replay sig', async () => {
          const { token, host, otherAccounts } = await loadFixture(deployNiteTokenFixture);
          const deadline = (await time.latest()) + 1 * min;
          const spender = otherAccounts[0];

          // generate signature
          const sigs = await generateSignature(token, host, spender.address, firstTokenId, deadline);

          await token.connect(host).permit(spender, firstTokenId, deadline, sigs);
          await expect(token.connect(host).permit(spender, firstTokenId, deadline, sigs)).revertedWithCustomError(
            token,
            'InvalidPermitSignature',
          );
        });
      });
    });

    describe('by user', () => {
      beforeEach(async function () {
        Object.assign(this, await loadFixture(deployNiteTokenFixture));
        const [from, spender, to] = this.otherAccounts;
        Object.assign(this, { from, spender, to });

        await this.token.connect(this.host).unpause();
        await this.token.connect(this.host).safeTransferFrom(this.host.address, this.from.address, firstTokenId);
      });

      it('should permit', async function () {
        const deadline = (await time.latest()) + 1 * min;

        // generate signature
        const sigs = await generateSignature(this.token, this.from, this.spender.address, firstTokenId, deadline);

        await expect(this.token.connect(this.host).permit(this.spender.address, firstTokenId, deadline, sigs))
          .emit(this.token, 'Approval')
          .withArgs(this.from.address, this.spender.address, firstTokenId);

        await expect(
          this.token
            .connect(this.spender)
            ['safeTransferFrom(address,address,uint256)'](this.from.address, this.to.address, firstTokenId),
        )
          .emit(this.token, 'Transfer')
          .withArgs(this.from.address, this.to.address, firstTokenId);
      });

      it('transfer with permit', async function () {
        const deadline = (await time.latest()) + 1 * min;

        // generate signature
        const sigs = await generateSignature(this.token, this.from, this.spender.address, firstTokenId, deadline);

        const tx = await this.token
          .connect(this.spender)
          .transferWithPermit(this.to.address, firstTokenId, deadline, sigs);

        await expect(tx).emit(this.token, 'Approval').withArgs(this.from.address, this.spender.address, firstTokenId);
        await expect(tx).emit(this.token, 'Transfer').withArgs(this.from.address, this.to.address, firstTokenId);
      });

      it('revert if spender is the owner', async function () {
        const deadline = (await time.latest()) + 1 * min;
        this.spender = this.from;

        // generate signature
        const sigs = await generateSignature(this.token, this.from, this.spender.address, firstTokenId, deadline);

        await expect(
          this.token.connect(this.spender).permit(this.spender, firstTokenId, deadline, sigs),
        ).revertedWithCustomError(this.token, 'ApprovalToCurrentOwner');
      });

      describe('validate sigature', () => {
        it('revert if the permit has expired', async function () {
          const deadline = (await time.latest()) - 1 * min;

          // generate signature
          const sigs = await generateSignature(this.token, this.from, this.spender.address, firstTokenId, deadline);

          await expect(
            this.token.connect(this.host).permit(this.spender, firstTokenId, deadline, sigs),
          ).revertedWithCustomError(this.token, 'PermitExpired');
        });

        it('revert if caller does match with sig', async function () {
          const deadline = (await time.latest()) + 1 * min;

          // generate signature
          const sigs = await generateSignature(this.token, this.spender, this.spender.address, firstTokenId, deadline);

          await expect(
            this.token.connect(this.host).permit(this.spender, firstTokenId, deadline, sigs),
          ).revertedWithCustomError(this.token, 'InvalidPermitSignature');
        });

        it('revert if spender param does match with sig', async function () {
          const deadline = (await time.latest()) + 1 * min;

          // generate signature
          const sigs = await generateSignature(this.token, this.from, this.to.address, firstTokenId, deadline);

          await expect(
            this.token.connect(this.host).permit(this.spender.address, firstTokenId, deadline, sigs),
          ).revertedWithCustomError(this.token, 'InvalidPermitSignature');
        });

        it('revert if tokenId param does match with sig', async function () {
          const deadline = (await time.latest()) + 1 * min;

          // generate signature
          const sigs = await generateSignature(this.token, this.from, this.spender.address, fourthTokenId, deadline);

          await expect(
            this.token.connect(this.spender).permit(this.spender, firstTokenId, deadline, sigs),
          ).revertedWithCustomError(this.token, 'InvalidPermitSignature');
        });

        it('revert if deadline param does match with sig', async function () {
          const deadline = (await time.latest()) + 1 * min;

          // generate signature
          const sigs = await generateSignature(this.token, this.from, this.spender.address, firstTokenId, deadline);

          await expect(
            this.token.connect(this.spender).permit(this.spender.address, firstTokenId, deadline + 2 * min, sigs),
          ).revertedWithCustomError(this.token, 'InvalidPermitSignature');
        });

        it('revert if nonce param does match with sig', async function () {
          const deadline = (await time.latest()) + 1 * min;

          // generate signature
          const sigs = await generateSignature(this.token, this.from, this.spender.address, firstTokenId, deadline, 2n);

          await expect(
            this.token.connect(this.host).permit(this.spender.address, firstTokenId, deadline, sigs),
          ).revertedWithCustomError(this.token, 'InvalidPermitSignature');
        });

        it('revert if replay sig', async function () {
          const deadline = (await time.latest()) + 1 * min;

          // generate signature
          const sigs = await generateSignature(this.token, this.from, this.spender.address, firstTokenId, deadline);

          await this.token.connect(this.spender).permit(this.spender.address, firstTokenId, deadline, sigs);
          await expect(
            this.token.connect(this.spender).permit(this.spender, firstTokenId, deadline, sigs),
          ).revertedWithCustomError(this.token, 'InvalidPermitSignature');
        });
      });
    });
  });
});
