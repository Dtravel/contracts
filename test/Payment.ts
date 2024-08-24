import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ZeroAddress } from 'ethers';

describe('Payment', () => {
  async function deployPaymentFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, treasury, ...otherAccounts] = await ethers.getSigners();
    const initialBalance = 10000;
    const fee = 2000; // 2%

    const token1 = await ethers.deployContract('ERC20Test', ['Tether', 'USDT']);
    const token2 = await ethers.deployContract('ERC20Test', ['USD Coin', 'USDC']);

    const payment = await ethers.deployContract('Payment', [treasury.address, fee]);

    await token1.mint(otherAccounts[0].address, initialBalance);
    await token2.mint(otherAccounts[0].address, initialBalance);

    return { payment, owner, treasury, otherAccounts, token1, token2, fee, initialBalance };
  }

  describe('Deployment', () => {
    it('revert deployment on zero address treasury', async () => {
      const paymentFactory = await ethers.getContractFactory('Payment');

      await expect(ethers.deployContract('Payment', [ZeroAddress, 200])).revertedWithCustomError(
        paymentFactory,
        'ZeroAddress',
      );
    });
  });

  describe('Set treasury', () => {
    it('set the right treasury', async () => {
      const { payment, treasury } = await loadFixture(deployPaymentFixture);

      const res = await payment.treasury();

      expect(res).deep.equal(treasury.address);
    });

    it('set the new treasury', async () => {
      const { payment, treasury } = await loadFixture(deployPaymentFixture);

      await expect(payment.setTreasury(treasury.address)).to.emit(payment, 'NewTreasury').withArgs(treasury.address);
    });

    it('revert if set treasury to zero address', async () => {
      const { payment } = await loadFixture(deployPaymentFixture);

      await expect(payment.setTreasury(ZeroAddress)).revertedWithCustomError(payment, 'ZeroAddress');
    });

    it('revert if caller is not OPERATOR', async () => {
      const { payment, otherAccounts } = await loadFixture(deployPaymentFixture);

      await expect(payment.connect(otherAccounts[4]).setTreasury(otherAccounts[5].address)).revertedWithCustomError(
        payment,
        'OwnableUnauthorizedAccount',
      );
    });
  });

  describe('Set fee', () => {
    it('set the right fee amount', async () => {
      const { payment, fee } = await loadFixture(deployPaymentFixture);

      const res = await payment.feeNumerator();

      expect(res).deep.equal(fee);
    });

    it('set the new fee amount', async () => {
      const { payment } = await loadFixture(deployPaymentFixture);
      const newFee = 200;

      await expect(payment.setFee(newFee)).to.emit(payment, 'NewFeeNumerator').withArgs(newFee);
    });

    it('revert if caller is not OPERATOR', async () => {
      const { payment, otherAccounts } = await loadFixture(deployPaymentFixture);

      await expect(payment.connect(otherAccounts[4]).setFee(100)).revertedWithCustomError(
        payment,
        'OwnableUnauthorizedAccount',
      );
    });
  });

  describe('Set fixed fee', () => {
    it('set the new fixed fee', async () => {
      const { payment, token1 } = await loadFixture(deployPaymentFixture);
      const newFee = 200;
      const usdt = await token1.getAddress();

      await expect(payment.setFixedFee(usdt, newFee)).to.emit(payment, 'NewFixedFee').withArgs(usdt, newFee);
      expect(await payment.fixedFees(usdt)).deep.equal(newFee);
    });

    it('revert if caller is not OPERATOR', async () => {
      const { payment, token2, otherAccounts } = await loadFixture(deployPaymentFixture);
      const usdc = await token2.getAddress();

      await expect(payment.connect(otherAccounts[4]).setFixedFee(usdc, 100)).revertedWithCustomError(
        payment,
        'OwnableUnauthorizedAccount',
      );
    });
  });

  describe('Make payment', () => {
    it('make payments in native coin and erc20', async () => {
      const { payment, treasury, token1, token2, otherAccounts, fee } = await loadFixture(deployPaymentFixture);

      const paymentId = 1;
      const payments = [
        { token: await token1.getAddress(), receiver: otherAccounts[1].address, amount: 1000n },
        { token: await token2.getAddress(), receiver: otherAccounts[1].address, amount: 2000n },
        { token: await token2.getAddress(), receiver: otherAccounts[1].address, amount: 3000n },
        { token: await token2.getAddress(), receiver: otherAccounts[2].address, amount: 0n },
        { token: ZeroAddress, receiver: otherAccounts[1].address, amount: 50000 },
      ];

      /*
      const encodedPayments = [];
      for (let i = 0; i < payments.length; i++) {
        const encodedVal = AbiCoder.defaultAbiCoder().encode(
          ['(address,address,uint256)'],
          [Object.values(payments[i])],
        );
        encodedPayments.push(encodedVal);
      }

      const indexedHash = keccak256(solidityPacked(Array(payments.length).fill('bytes'), encodedPayments));
      */

      await token1.connect(otherAccounts[0]).approve(await payment.getAddress(), 1000 * (1 + fee / 10000));
      await token2.connect(otherAccounts[0]).approve(await payment.getAddress(), 5000 * (1 + fee / 10000));

      const tx = await payment.connect(otherAccounts[0]).makePayment(paymentId, payments, {
        value: 50000 * (1 + fee / 10000),
      });

      await expect(tx).emit(payment, 'MakePayment').withArgs(paymentId, otherAccounts[0].address, anyValue); // 3rd argument should be `indexedHash` but Hardhat not supported yet

      await expect(tx).to.changeEtherBalances(
        [otherAccounts[0], otherAccounts[1], treasury],
        [-50000 * (1 + fee / 10000), 50000, (50000 * fee) / 10000],
      );

      await expect(tx).to.changeTokenBalances(
        token1,
        [otherAccounts[0], otherAccounts[1], treasury],
        [-1000 * (1 + fee / 10000), 1000, (1000 * fee) / 10000],
      );

      await expect(tx).to.changeTokenBalances(
        token2,
        [otherAccounts[0], otherAccounts[1], treasury],
        [-5000 * (1 + fee / 10000), 5000, (5000 * fee) / 10000],
      );
    });

    it('charge fixed fees in native coin and erc20', async () => {
      const { owner, payment, treasury, token1, token2, otherAccounts, fee } = await loadFixture(deployPaymentFixture);

      // admin updates fixed fee
      await payment.connect(owner).setFixedFee(ZeroAddress, 20); // native coin
      await payment.connect(owner).setFixedFee(token2, 10);

      const paymentId = 1;
      const payments = [
        { token: await token1.getAddress(), receiver: otherAccounts[1].address, amount: 1000n }, // fixed fee = 0
        { token: await token2.getAddress(), receiver: otherAccounts[1].address, amount: 2000n }, // fixed fee = 10
        { token: await token2.getAddress(), receiver: otherAccounts[1].address, amount: 3000n }, // fixed fee = 10
        { token: await token2.getAddress(), receiver: otherAccounts[2].address, amount: 0n }, // fixed fee = 10
        { token: ZeroAddress, receiver: otherAccounts[1].address, amount: 50000 }, // fixed fee = 20
        { token: ZeroAddress, receiver: otherAccounts[2].address, amount: 0 }, // fixed fee = 20
      ];

      // admin update fixed fees

      await token1.connect(otherAccounts[0]).approve(await payment.getAddress(), 1000 * (1 + fee / 10000));
      await token2.connect(otherAccounts[0]).approve(await payment.getAddress(), 5000 * (1 + fee / 10000) + 30);

      const tx = await payment.connect(otherAccounts[0]).makePayment(paymentId, payments, {
        value: 50000 * (1 + fee / 10000) + 20 + 20,
      });

      await expect(tx).emit(payment, 'MakePayment').withArgs(paymentId, otherAccounts[0].address, anyValue);

      await expect(tx).to.changeEtherBalances(
        [otherAccounts[0], otherAccounts[1], treasury],
        [-50000 * (1 + fee / 10000) - 40, 50000, (50000 * fee) / 10000 + 40],
      );

      await expect(tx).to.changeTokenBalances(
        token1,
        [otherAccounts[0], otherAccounts[1], treasury],
        [-1000 * (1 + fee / 10000), 1000, (1000 * fee) / 10000],
      );

      await expect(tx).to.changeTokenBalances(
        token2,
        [otherAccounts[0], otherAccounts[1], treasury],
        [-5000 * (1 + fee / 10000) - 30, 5000, (5000 * fee) / 10000 + 30],
      );
    });

    it('revert if the payment list is empty', async () => {
      const { payment } = await loadFixture(deployPaymentFixture);

      const paymentId = 1;
      await expect(payment.makePayment(paymentId, [])).revertedWithCustomError(payment, 'EmptyPaymentList');
    });

    it('revert when caller makes payment in native coin but msg.value is empty', async () => {
      const { payment, otherAccounts } = await loadFixture(deployPaymentFixture);

      const paymentId = 2;
      const payments = [{ token: ZeroAddress, receiver: otherAccounts[1].address, amount: 60000 }];
      await expect(payment.makePayment(paymentId, payments)).revertedWithCustomError(payment, 'TransferFailed');
    });

    it('revert when caller makes payment in erc20 but allowance is insufficient', async () => {
      const { payment, token1, otherAccounts, initialBalance } = await loadFixture(deployPaymentFixture);

      const paymentId = 2;
      const payments = [
        { token: await token1.getAddress(), receiver: otherAccounts[1].address, amount: initialBalance + 1 },
      ];
      await token1.approve(await payment.getAddress(), initialBalance + 1);
      await expect(payment.makePayment(paymentId, payments)).revertedWithCustomError(
        token1,
        'ERC20InsufficientBalance',
      );
    });

    it('revert when caller makes payment in erc20 but balance is insufficient', async () => {
      const { payment, token1, otherAccounts, initialBalance } = await loadFixture(deployPaymentFixture);

      const paymentId = 2;
      const payments = [
        { token: await token1.getAddress(), receiver: otherAccounts[1].address, amount: initialBalance + 1 },
      ];
      await token1.approve(await payment.getAddress(), initialBalance);
      await expect(payment.makePayment(paymentId, payments)).revertedWithCustomError(
        token1,
        'ERC20InsufficientAllowance',
      );
    });
  });
});
