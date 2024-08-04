import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { AbiCoder, ZeroAddress, getAddress, keccak256, solidityPacked, toUtf8Bytes } from 'ethers';

describe('Factory', function () {
  function computeCreate2Address(saltHex: string, bytecode: string, deployer: string) {
    return getAddress(
      '0x' +
        keccak256(
          solidityPacked(['bytes', 'address', 'bytes32', 'bytes32'], ['0xff', deployer, saltHex, keccak256(bytecode)]),
        ).slice(-40),
    );
  }

  async function deployFactoryFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, operator, treasury, ...otherAccounts] = await ethers.getSigners();

    const gasToken = await ethers.deployContract('ERC20Test', ['token1', 'TK1']);

    const fee = 500;

    const factoryFactory = await ethers.getContractFactory('Factory');
    const factory = await factoryFactory.deploy(operator.address, treasury.address, await gasToken.getAddress(), fee);

    return { factory, owner, operator, treasury, otherAccounts, gasToken, fee };
  }

  describe('Deployment', () => {
    it('revert if operator is zero address', async () => {
      const { treasury } = await loadFixture(deployFactoryFixture);

      const gasToken = await ethers.deployContract('ERC20Test', ['token1', 'TK1']);

      const fee = 500;

      const factoryFactory = await ethers.getContractFactory('Factory');
      await expect(
        factoryFactory.deploy(ZeroAddress, treasury.address, gasToken.getAddress(), fee),
      ).revertedWithCustomError(factoryFactory, 'ZeroAddress');
    });

    it('revert if treasury is zero address', async () => {
      const { operator } = await loadFixture(deployFactoryFixture);

      const gasToken = await ethers.deployContract('ERC20Test', ['token1', 'TK1']);

      const fee = 500;

      const factoryFactory = await ethers.getContractFactory('Factory');
      await expect(
        factoryFactory.deploy(operator.address, ZeroAddress, gasToken.getAddress(), fee),
      ).revertedWithCustomError(factoryFactory, 'ZeroAddress');
    });

    it('revert if gas token is zero address', async () => {
      const { operator, treasury } = await loadFixture(deployFactoryFixture);
      const fee = 500;

      const factoryFactory = await ethers.getContractFactory('Factory');
      await expect(factoryFactory.deploy(operator.address, treasury.address, ZeroAddress, fee)).revertedWithCustomError(
        factoryFactory,
        'ZeroAddress',
      );
    });
  });

  describe('Set operator', () => {
    it('set the right owner', async () => {
      const { factory, owner } = await loadFixture(deployFactoryFixture);
      expect(await factory.owner()).deep.equal(owner.address);
    });

    it('set the right operator', async () => {
      const { factory, otherAccounts } = await loadFixture(deployFactoryFixture);
      const newOperator = otherAccounts[0].address;

      await expect(factory.setOperator(newOperator)).to.emit(factory, 'NewOperator').withArgs(newOperator);
    });

    it('remove operator', async () => {
      const { factory } = await loadFixture(deployFactoryFixture);

      await expect(factory.setOperator(ZeroAddress)).emit(factory, 'NewOperator').withArgs(ZeroAddress);
    });

    it('revert if caller is not OPERATOR', async () => {
      const { factory, otherAccounts } = await loadFixture(deployFactoryFixture);
      const newOperator = otherAccounts[3].address;

      await expect(factory.connect(otherAccounts[4]).setOperator(newOperator)).revertedWithCustomError(
        factory,
        'OwnableUnauthorizedAccount',
      );
    });
  });

  describe('Set treasury', () => {
    it('set the right treasury', async () => {
      const { factory, treasury } = await loadFixture(deployFactoryFixture);

      const res = await factory.treasury();

      expect(res).deep.equal(treasury.address);
    });

    it('set the new treasury', async () => {
      const { factory, treasury } = await loadFixture(deployFactoryFixture);

      await expect(factory.setTreasury(treasury.address)).to.emit(factory, 'NewTreasury').withArgs(treasury.address);
    });

    it('revert if set treasury to zero address', async () => {
      const { factory } = await loadFixture(deployFactoryFixture);

      await expect(factory.setTreasury(ZeroAddress)).revertedWithCustomError(factory, 'ZeroAddress');
    });

    it('revert if caller is not OPERATOR', async () => {
      const { factory, otherAccounts } = await loadFixture(deployFactoryFixture);

      await expect(factory.connect(otherAccounts[4]).setTreasury(otherAccounts[5].address)).revertedWithCustomError(
        factory,
        'OwnableUnauthorizedAccount',
      );
    });
  });

  describe('Set fee amount per Nite transfer', () => {
    it('set the right gas token', async () => {
      const { factory, gasToken } = await loadFixture(deployFactoryFixture);
      const token = await factory.gasToken();

      expect(token).deep.equal(await gasToken.getAddress());
    });

    it('set the right fee amount', async () => {
      const { factory, fee } = await loadFixture(deployFactoryFixture);

      const res = await factory.feeAmountPerTransfer();

      expect(res).deep.equal(fee);
    });

    it('set the new fee amount', async () => {
      const { factory } = await loadFixture(deployFactoryFixture);
      const newFee = 200;

      await expect(factory.setFeeAmountPerTransfer(newFee))
        .to.emit(factory, 'NewFeeAmountPerTransfer')
        .withArgs(newFee);
    });

    it('revert if caller is not OPERATOR', async () => {
      const { factory, otherAccounts } = await loadFixture(deployFactoryFixture);

      await expect(factory.connect(otherAccounts[4]).setFeeAmountPerTransfer(100)).revertedWithCustomError(
        factory,
        'OwnableUnauthorizedAccount',
      );
    });
  });

  describe('Create Nite token contract', () => {
    it('operator can create Nite token contract', async () => {
      const { factory, operator, otherAccounts } = await loadFixture(deployFactoryFixture);
      const factoryAddress = await factory.getAddress();

      const slot = 1;
      const host = otherAccounts[2];
      const name = 'Nites in Mansion in Mars';
      const symbol = 'NT';
      const uri = 'http://ipfs.io/ipfs/NT/';

      // compute offchain address before deploying a new RNT contact
      const salt = keccak256(
        solidityPacked(['address', 'uint256', 'bytes32'], [host.address, slot, keccak256(toUtf8Bytes('BOOKING_V4'))]),
      );

      const encodedParams = AbiCoder.defaultAbiCoder()
        .encode(
          ['address', 'address', 'address', 'string', 'string', 'string'],
          [host.address, operator.address, factoryAddress, name, symbol, uri],
        )
        .slice(2);

      const niteTokenFactory = await ethers.getContractFactory('NiteToken');
      const constructorByteCode = `${niteTokenFactory.bytecode}${encodedParams}`;

      const offchainComputed = computeCreate2Address(salt, constructorByteCode, factoryAddress);

      await expect(factory.connect(operator).createNiteContract(slot, host.address, name, uri))
        .emit(factory, 'NewNiteContract')
        .withArgs(slot, offchainComputed, host.address);
    });

    it('host can create Nite token contract', async () => {
      const { factory, operator, otherAccounts } = await loadFixture(deployFactoryFixture);
      const factoryAddress = await factory.getAddress();

      const slot = 1;
      const host = otherAccounts[2];
      const name = 'Nites in Mansion in Mars';
      const symbol = 'NT';
      const uri = 'http://ipfs.io/ipfs/NT/';

      // compute offchain address before deploying a new RNT contact
      const salt = keccak256(
        solidityPacked(['address', 'uint256', 'bytes32'], [host.address, slot, keccak256(toUtf8Bytes('BOOKING_V4'))]),
      );

      const encodedParams = AbiCoder.defaultAbiCoder()
        .encode(
          ['address', 'address', 'address', 'string', 'string', 'string'],
          [host.address, operator.address, factoryAddress, name, symbol, uri],
        )
        .slice(2);

      const niteTokenFactory = await ethers.getContractFactory('NiteToken');
      const constructorByteCode = `${niteTokenFactory.bytecode}${encodedParams}`;

      const offchainComputed = computeCreate2Address(salt, constructorByteCode, factoryAddress);

      await expect(factory.connect(host).createNiteContract(slot, host.address, name, uri))
        .emit(factory, 'NewNiteContract')
        .withArgs(slot, offchainComputed, host.address);
    });

    it('anyone can create Nite token contract', async () => {
      const { factory, operator, otherAccounts } = await loadFixture(deployFactoryFixture);
      const factoryAddress = await factory.getAddress();

      const slot = 1;
      const host = otherAccounts[2];
      const name = 'Nites in Mansion in Mars';
      const symbol = 'NT';
      const uri = 'http://ipfs.io/ipfs/NT/';

      // compute offchain address before deploying a new RNT contact
      const salt = keccak256(
        solidityPacked(['address', 'uint256', 'bytes32'], [host.address, slot, keccak256(toUtf8Bytes('BOOKING_V4'))]),
      );

      const encodedParams = AbiCoder.defaultAbiCoder()
        .encode(
          ['address', 'address', 'address', 'string', 'string', 'string'],
          [host.address, operator.address, factoryAddress, name, symbol, uri],
        )
        .slice(2);

      const niteTokenFactory = await ethers.getContractFactory('NiteToken');
      const constructorByteCode = `${niteTokenFactory.bytecode}${encodedParams}`;

      const offchainComputed = computeCreate2Address(salt, constructorByteCode, factoryAddress);

      await expect(factory.connect(otherAccounts[0]).createNiteContract(slot, host.address, name, uri))
        .emit(factory, 'NewNiteContract')
        .withArgs(slot, offchainComputed, host.address);
    });

    it('revert if token contract is already deployed', async () => {
      const { factory, otherAccounts } = await loadFixture(deployFactoryFixture);

      const slot = 1;
      const host = otherAccounts[2];
      const name = 'Nites in Mansion in Mars';
      const uri = 'http://ipfs.io/ipfs/NT/';

      await factory.createNiteContract(slot, host.address, name, uri);

      await expect(factory.createNiteContract(slot, host.address, name, uri)).revertedWithCustomError(
        factory,
        'TokenDeployedAlready',
      );
    });

    it('revert if slot id is already taken', async () => {
      const { factory, otherAccounts } = await loadFixture(deployFactoryFixture);

      const slot = 1;
      const host = otherAccounts[2];
      let name = 'Nites in Mansion in Mars';
      let uri = 'http://ipfs.io/ipfs/NT1/';

      await factory.createNiteContract(slot, host.address, name, uri);

      name = 'Nites in Motel in Venus';
      uri = 'http://ipfs.io/ipfs/NT2/';

      await expect(factory.createNiteContract(slot, host.address, name, uri)).revertedWithCustomError(
        factory,
        'TokenDeployedAlready',
      );
    });
  });
});
