import { ethers } from 'hardhat';
import { expect } from 'chai';
import { PANIC_CODES } from '@nomicfoundation/hardhat-chai-matchers/panic';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';

import { shouldSupportInterfaces } from './utils/SupportsInterface.behavior';
import { Typed, ZeroAddress } from 'ethers';
import { getRandomInt, Enum } from './utils/helpers';

const firstTokenId = 5042n;
const secondTokenId = 79217n;
const fourthTokenId = 4n;

const RECEIVER_MAGIC_VALUE = '0x150b7a02';

const RevertType = Enum({
  options: ['None', 'RevertWithoutMessage', 'RevertWithMessage', 'RevertWithCustomError', 'Panic'],
});

export function shouldBehaveLikeERC721Booking() {
  beforeEach(async function () {
    const [owner, newOwner, approved, operator, other] = this.otherAccounts;
    Object.assign(this, { owner, newOwner, approved, operator, other });
  });

  shouldSupportInterfaces(['ERC721']);

  describe('deployment', function () {
    it('get the right host', async function () {
      expect(await this.token.HOST()).deep.equal(this.host.address);
    });

    it('get the right factory', async function () {
      expect(await this.token.FACTORY()).deep.equal(await this.factory.getAddress());
    });

    it('revert on deployment with zero address host', async function () {
      const { factory, operator, name, symbol, uri } = this;

      const niteFactory = await ethers.getContractFactory('NiteToken');
      await expect(
        ethers.deployContract('NiteToken', [ZeroAddress, operator.address, factory.getAddress(), name, symbol, uri]),
      ).revertedWithCustomError(niteFactory, 'ZeroAddress');
    });

    it('revert on deployment with zero address factory', async function () {
      const { host, operator, name, symbol, uri } = this;

      const niteFactory = await ethers.getContractFactory('NiteToken');
      await expect(
        ethers.deployContract('NiteToken', [host.address, operator.address, ZeroAddress, name, symbol, uri]),
      ).revertedWithCustomError(niteFactory, 'ZeroAddress');
    });
  });

  describe('Host and operators', function () {
    beforeEach(async function () {
      this.to = this.other;
    });

    describe('balanceOf', function () {
      describe('when the given address owns some tokens', function () {
        it('returns the amount of tokens owned by the given address', async function () {
          // transfer token from host to the other
          await this.token.connect(this.host).transferFrom(this.host.address, this.owner.address, secondTokenId);
          expect(await this.token.ownerOf(secondTokenId)).deep.equal(this.owner.address);

          await this.token.connect(this.host).transferFrom(this.host.address, this.owner.address, fourthTokenId);
          expect(await this.token.ownerOf(fourthTokenId)).deep.equal(this.owner.address);

          expect(await this.token.balanceOf(this.owner)).deep.equal(2n);
        });
      });

      describe('when the given address does not own any tokens', function () {
        it('returns 0', async function () {
          expect(await this.token.balanceOf(this.otherAccounts[1].address)).deep.equal(0n);
        });
      });

      describe('when querying the zero address', function () {
        it('throws', async function () {
          await expect(this.token.balanceOf(ZeroAddress)).revertedWithCustomError(this.token, 'ZeroAddress');
        });
      });
    });

    describe('ownerOf', function () {
      it('host initially owns all tokens', async function () {
        // the quantity of token is infinity, this test only verify a simple happy case
        // that take a random token and expect that it is belong to host
        const tokenId = getRandomInt(1, 100);

        expect(await this.token.ownerOf(tokenId)).deep.equal(this.host.address);
      });

      it('returns owner of the given token ID', async function () {
        const tokenId = getRandomInt(1, 100);

        // transfer token from host to the other
        await this.token.connect(this.host).transferFrom(this.host.address, this.owner.address, tokenId);
        expect(await this.token.ownerOf(tokenId)).deep.equal(this.owner.address);
      });
    });

    describe('transfers', function () {
      const tokenId = firstTokenId;
      const data = '0x42';

      beforeEach(async function () {
        await this.token.connect(this.host).unpause();

        this.owner = this.host;
        await this.token.connect(this.owner).approve(this.approved, tokenId);
        await this.token.connect(this.owner).setApprovalForAll(this.operator, true);
      });

      const transferWasSuccessful = () => {
        it('transfers the ownership of the given token ID to the given address', async function () {
          await this.tx();
          expect(await this.token.ownerOf(tokenId)).to.equal(this.to);
        });

        it('emits a Transfer event', async function () {
          await expect(this.tx()).to.emit(this.token, 'Transfer').withArgs(this.owner, this.to, tokenId);
        });

        it('clears the approval for the token ID with no event', async function () {
          await expect(this.tx()).to.not.emit(this.token, 'Approval');

          expect(await this.token.getApproved(tokenId)).to.equal(ethers.ZeroAddress);
        });

        it('adjusts owners balances', async function () {
          const balanceBefore = await this.token.balanceOf(this.owner);
          await this.tx();
          expect(await this.token.balanceOf(this.owner)).to.equal(balanceBefore);
        });

        it('adjusts owners tokens by index', async function () {
          if (!this.token.tokenOfOwnerByIndex) return;

          await this.tx();
          expect(await this.token.tokenOfOwnerByIndex(this.to, 0n)).to.equal(tokenId);
          expect(await this.token.tokenOfOwnerByIndex(this.owner, 0n)).to.not.equal(tokenId);
        });
      };

      // eslint-disable-next-line
      const shouldTransferTokensByUsers = function (fragment: string | number, opts: any = {}) {
        describe('when called by the owner', function () {
          beforeEach(async function () {
            this.owner = this.host;
            this.tx = () =>
              this.token.connect(this.owner)[fragment](this.owner, this.to, tokenId, ...(opts.extra ?? []));
          });
          transferWasSuccessful();
        });

        describe('when called by the approved individual', function () {
          beforeEach(async function () {
            this.tx = () =>
              this.token.connect(this.approved)[fragment](this.owner, this.to, tokenId, ...(opts.extra ?? []));
          });
          transferWasSuccessful();
        });

        describe('when called by the operator', function () {
          beforeEach(async function () {
            this.tx = () =>
              this.token.connect(this.operator)[fragment](this.owner, this.to, tokenId, ...(opts.extra ?? []));
          });
          transferWasSuccessful();
        });

        describe('when called by the owner without an approved user', function () {
          beforeEach(async function () {
            await this.token.connect(this.owner).approve(ethers.ZeroAddress, tokenId);
            this.tx = () =>
              this.token.connect(this.operator)[fragment](this.owner, this.to, tokenId, ...(opts.extra ?? []));
          });
          transferWasSuccessful();
        });

        describe('when sent to the owner', function () {
          beforeEach(async function () {
            this.tx = () =>
              this.token.connect(this.owner)[fragment](this.owner, this.owner, tokenId, ...(opts.extra ?? []));
          });

          it('keeps ownership of the token', async function () {
            await this.tx();
            expect(await this.token.ownerOf(tokenId)).to.equal(this.owner);
          });

          it('clears the approval for the token ID', async function () {
            await this.tx();
            expect(await this.token.getApproved(tokenId)).to.equal(ethers.ZeroAddress);
          });

          it('emits only a transfer event', async function () {
            await expect(this.tx()).to.emit(this.token, 'Transfer').withArgs(this.owner, this.owner, tokenId);
          });

          it('keeps the owner balance - host send to himself', async function () {
            const balanceBefore = await this.token.balanceOf(this.owner);
            await this.tx();
            expect(await this.token.balanceOf(this.owner)).to.equal(balanceBefore + 1n);
          });
        });

        describe('when the address of the previous owner is incorrect', function () {
          it('reverts', async function () {
            await expect(
              this.token.connect(this.owner)[fragment](this.other, this.other, tokenId, ...(opts.extra ?? [])),
            ).revertedWithCustomError(this.token, 'WrongFrom');
          });
        });

        describe('when the sender is not authorized for the token id', function () {
          if (opts.unrestricted) {
            it('does not revert', async function () {
              await this.token.connect(this.other)[fragment](this.owner, this.other, tokenId, ...(opts.extra ?? []));
            });
          } else {
            it('reverts', async function () {
              await expect(
                this.token.connect(this.other)[fragment](this.owner, this.other, tokenId, ...(opts.extra ?? [])),
              ).revertedWithCustomError(this.token, 'Unauthorized');
            });
          }
        });
      };

      // eslint-disable-next-line
      const shouldTransferSafely = function (fragment: string | number, data: any, opts: any = {}) {
        // sanity
        it('function exists', async function () {
          expect(this.token.interface.hasFunction(fragment)).true;
        });

        describe('to a user account', function () {
          shouldTransferTokensByUsers(fragment, opts);
        });

        describe('to a valid receiver contract', function () {
          beforeEach(async function () {
            this.owner = this.host;
            this.to = await ethers.deployContract('ERC721ReceiverMock', [RECEIVER_MAGIC_VALUE, RevertType.None]);
          });

          shouldTransferTokensByUsers(fragment, opts);

          it('calls onERC721Received', async function () {
            await expect(this.token.connect(this.owner)[fragment](this.owner, this.to, tokenId, ...(opts.extra ?? [])))
              .to.emit(this.to, 'Received')
              .withArgs(this.owner, this.owner, tokenId, data, anyValue);
          });

          it('calls onERC721Received from approved', async function () {
            await expect(
              this.token.connect(this.approved)[fragment](this.owner, this.to, tokenId, ...(opts.extra ?? [])),
            )
              .to.emit(this.to, 'Received')
              .withArgs(this.approved, this.owner, tokenId, data, anyValue);
          });
        });
      };

      const params = { fnName: 'transferFrom', opts: {} };
      describe(`via ${params.fnName}`, function () {
        shouldTransferTokensByUsers(params.fnName, params.opts);
      });

      for (const { fnName, opts } of [{ fnName: 'safeTransferFrom', opts: {} }]) {
        describe(`via ${fnName}`, function () {
          describe('with data', function () {
            shouldTransferSafely(fnName, data, { ...opts, extra: [Typed.bytes(data)] });
          });

          describe('without data', function () {
            shouldTransferSafely(fnName, '0x', opts);
          });

          describe('to a receiver contract returning unexpected value', function () {
            it('reverts', async function () {
              const invalidReceiver = await ethers.deployContract('ERC721ReceiverMock', [
                '0xdeadbeef',
                RevertType.None,
              ]);

              await expect(
                this.token.connect(this.owner)[fnName](this.owner, invalidReceiver, tokenId),
              ).revertedWithCustomError(this.token, 'UnsafeRecipient');
            });
          });

          describe('to a receiver contract that reverts with message', function () {
            it('reverts', async function () {
              const revertingReceiver = await ethers.deployContract('ERC721ReceiverMock', [
                RECEIVER_MAGIC_VALUE,
                RevertType.RevertWithMessage,
              ]);

              await expect(this.token.connect(this.owner)[fnName](this.owner, revertingReceiver, tokenId)).revertedWith(
                'ERC721ReceiverMock: reverting',
              );
            });
          });

          describe('to a receiver contract that reverts without message', function () {
            it('reverts', async function () {
              const revertingReceiver = await ethers.deployContract('ERC721ReceiverMock', [
                RECEIVER_MAGIC_VALUE,
                RevertType.RevertWithoutMessage,
              ]);

              await expect(this.token.connect(this.owner)[fnName](this.owner, revertingReceiver, tokenId)).reverted;
            });
          });

          describe('to a receiver contract that reverts with custom error', function () {
            it('reverts', async function () {
              const revertingReceiver = await ethers.deployContract('ERC721ReceiverMock', [
                RECEIVER_MAGIC_VALUE,
                RevertType.RevertWithCustomError,
              ]);

              await expect(this.token.connect(this.owner)[fnName](this.owner, revertingReceiver, tokenId))
                .revertedWithCustomError(revertingReceiver, 'CustomError')
                .withArgs(RECEIVER_MAGIC_VALUE);
            });
          });

          describe('to a receiver contract that panics', function () {
            it('reverts', async function () {
              const revertingReceiver = await ethers.deployContract('ERC721ReceiverMock', [
                RECEIVER_MAGIC_VALUE,
                RevertType.Panic,
              ]);

              await expect(
                this.token.connect(this.owner)[fnName](this.owner, revertingReceiver, tokenId),
              ).revertedWithPanic(PANIC_CODES.DIVISION_BY_ZERO);
            });
          });

          describe('to a contract that does not implement the required function', function () {
            it('reverts', async function () {
              const nonReceiver = await ethers.deployContract('CallReceiverMock');

              await expect(this.token.connect(this.owner)[fnName](this.owner, nonReceiver, tokenId)).reverted;
            });
          });
        });
      }

      describe('via SafeTransferFrom for all users', function () {
        describe('by host', function () {
          it('revert if from is not token owner', async function () {
            await expect(
              this.token.connect(this.host).safeTransferFrom(this.to.address, this.operator.address, secondTokenId),
            ).revertedWithCustomError(this.token, 'WrongFrom');
          });

          it('revert if sender is not token owner', async function () {
            await expect(
              this.token.connect(this.to).safeTransferFrom(this.host.address, this.operator.address, secondTokenId),
            ).revertedWithCustomError(this.token, 'Unauthorized');
          });

          it('transfer to non-zero address', async function () {
            expect(await this.token.balanceOf(this.host.address)).deep.equal(0);

            await this.token.connect(this.host).safeTransferFrom(this.host.address, this.to.address, firstTokenId);

            expect(await this.token.balanceOf(this.to.address)).deep.equal(1);
            expect(await this.token.balanceOf(this.host.address)).deep.equal(0);
            expect(await this.token.ownerOf(firstTokenId)).deep.equal(this.to.address);
          });

          it('transfer to zero address', async function () {
            expect(await this.token.balanceOf(this.host.address)).deep.equal(0);

            await this.token.connect(this.host).safeTransferFrom(this.host.address, ZeroAddress, firstTokenId);

            expect(await this.token.balanceOf(this.host.address)).deep.equal(0);
            expect(await this.token.ownerOf(firstTokenId)).deep.equal(this.host.address);
          });

          it('transfer to himself', async function () {
            expect(await this.token.balanceOf(this.host.address)).deep.equal(0);

            await this.token.connect(this.host).safeTransferFrom(this.host.address, this.host.address, firstTokenId);

            expect(await this.token.balanceOf(this.host.address)).deep.equal(1);
            expect(await this.token.ownerOf(firstTokenId)).deep.equal(this.host.address);
          });
        });

        describe('by operator', function () {
          it('revert if from is not token owner', async function () {
            await expect(
              this.token
                .connect(this.factoryOperator)
                .safeTransferFrom(this.to.address, this.operator.address, firstTokenId),
            ).revertedWithCustomError(this.token, 'WrongFrom');
          });

          it('revert if sender is not operator', async function () {
            await expect(
              this.token.connect(this.to).safeTransferFrom(this.host.address, this.to.address, firstTokenId),
            ).revertedWithCustomError(this.token, 'Unauthorized');
          });

          it('transfer to non-zero address', async function () {
            expect(await this.token.balanceOf(this.host.address)).deep.equal(0);
            expect(await this.token.balanceOf(this.factoryOperator.address)).deep.equal(0);

            await this.token
              .connect(this.factoryOperator)
              .safeTransferFrom(this.host.address, this.to.address, firstTokenId);

            expect(await this.token.balanceOf(this.to.address)).deep.equal(1n);
            expect(await this.token.ownerOf(firstTokenId)).deep.equal(this.to.address);
          });

          it('transfer to zero address', async function () {
            expect(await this.token.balanceOf(this.host.address)).deep.equal(0);
            expect(await this.token.balanceOf(this.factoryOperator.address)).deep.equal(0);

            await this.token
              .connect(this.factoryOperator)
              .safeTransferFrom(this.host.address, ZeroAddress, firstTokenId);

            expect(await this.token.balanceOf(this.host.address)).deep.equal(0);
            expect(await this.token.ownerOf(firstTokenId)).deep.equal(this.host.address);
          });
        });

        describe('by holder', function () {
          beforeEach(async function () {
            await this.token.connect(this.host).safeTransferFrom(this.host.address, this.to.address, firstTokenId);
          });

          it('revert if from is not token owner', async function () {
            await expect(
              this.token.connect(this.to).safeTransferFrom(this.host.address, this.operator.address, firstTokenId),
            ).revertedWithCustomError(this.token, 'WrongFrom');
          });

          it('revert if sender is not operator', async function () {
            await expect(
              this.token.connect(this.host).safeTransferFrom(this.to.address, this.operator.address, firstTokenId),
            ).revertedWithCustomError(this.token, 'Unauthorized');
          });

          it('transfer to non-zero address', async function () {
            expect(await this.token.balanceOf(this.to.address)).deep.equal(1);

            await this.token.connect(this.to).safeTransferFrom(this.to, this.operator.address, firstTokenId);

            expect(await this.token.balanceOf(this.to.address)).deep.equal(0);
            expect(await this.token.balanceOf(this.operator.address)).deep.equal(1);

            expect(await this.token.ownerOf(firstTokenId)).deep.equal(this.operator.address);
          });

          it('transfer to zero address', async function () {
            expect(await this.token.balanceOf(this.to.address)).deep.equal(1);

            await this.token.connect(this.to).safeTransferFrom(this.to, ZeroAddress, firstTokenId);

            expect(await this.token.balanceOf(this.to.address)).deep.equal(0);

            expect(await this.token.ownerOf(firstTokenId)).deep.equal(this.host.address);
          });
        });
      });

      describe('via SafeBatchTransfer for all users', function () {
        describe('by host', function () {
          it('revert if fromId > toId', async function () {
            await expect(
              this.token
                .connect(this.host)
                .safeBulkTransferFrom(this.host.address, this.to.address, firstTokenId, firstTokenId - 2n),
            ).revertedWithCustomError(this.token, 'InvalidTokenId');
          });

          it('revert if from is not token owner', async function () {
            await expect(
              this.token
                .connect(this.host)
                .safeBulkTransferFrom(this.to.address, this.to.address, firstTokenId, firstTokenId + 2n),
            ).revertedWithCustomError(this.token, 'WrongFrom');
          });

          it('revert if sender is not token owner', async function () {
            await expect(
              this.token
                .connect(this.to)
                .safeBulkTransferFrom(this.host.address, this.to.address, firstTokenId, firstTokenId + 2n),
            ).revertedWithCustomError(this.token, 'Unauthorized');
          });

          it('transfer bulk of tokens to non-zero address', async function () {
            expect(await this.token.balanceOf(this.host.address)).deep.equal(0);

            await this.token
              .connect(this.host)
              .safeBulkTransferFrom(this.host.address, this.to.address, firstTokenId, firstTokenId + 4n);

            expect(await this.token.balanceOf(this.to.address)).deep.equal(5);
            expect(await this.token.balanceOf(this.host.address)).deep.equal(0);
            for (let i = 0n; i < 5n; i++) {
              const res = await this.token.ownerOf(firstTokenId + i);
              expect(res).deep.equal(this.to.address);
            }
          });

          it('transfer bulk of tokens to zero address', async function () {
            expect(await this.token.balanceOf(this.host.address)).deep.equal(0);

            await this.token
              .connect(this.host)
              .safeBulkTransferFrom(this.host.address, ZeroAddress, firstTokenId, firstTokenId + 4n);

            expect(await this.token.balanceOf(this.host.address)).deep.equal(0);
            for (let i = 0n; i < 5n; i++) {
              const res = await this.token.ownerOf(firstTokenId + i);
              expect(res).deep.equal(this.host.address);
            }
          });

          it('transfer bulk of tokens to himself', async function () {
            expect(await this.token.balanceOf(this.host.address)).deep.equal(0);

            await this.token
              .connect(this.host)
              .safeBulkTransferFrom(this.host.address, this.host.address, firstTokenId, firstTokenId + 4n);

            expect(await this.token.balanceOf(this.host.address)).deep.equal(5);
            for (let i = 0n; i < 5n; i++) {
              const res = await this.token.ownerOf(firstTokenId + i);
              expect(res).deep.equal(this.host.address);
            }
          });
        });

        describe('by operator', function () {
          it('revert if fromId > toId', async function () {
            await expect(
              this.token
                .connect(this.factoryOperator)
                .safeBulkTransferFrom(this.host.address, this.to.address, firstTokenId, firstTokenId - 2n),
            ).revertedWithCustomError(this.token, 'InvalidTokenId');
          });

          it('revert if from is not token owner', async function () {
            await expect(
              this.token
                .connect(this.factoryOperator)
                .safeBulkTransferFrom(this.to.address, this.to.address, firstTokenId, firstTokenId + 2n),
            ).revertedWithCustomError(this.token, 'WrongFrom');
          });

          it('revert if sender is not operator', async function () {
            await expect(
              this.token
                .connect(this.to)
                .safeBulkTransferFrom(this.host.address, this.to.address, firstTokenId, firstTokenId + 2n),
            ).revertedWithCustomError(this.token, 'Unauthorized');
          });

          it('transfer bulk of tokens to non-zero address', async function () {
            expect(await this.token.balanceOf(this.operator.address)).deep.equal(0);

            await this.token
              .connect(this.factoryOperator)
              .safeBulkTransferFrom(this.host.address, this.to.address, firstTokenId, firstTokenId + 4n);

            expect(await this.token.balanceOf(this.to.address)).deep.equal(5);
            expect(await this.token.balanceOf(this.operator.address)).deep.equal(0);
            for (let i = 0n; i < 5n; i++) {
              const res = await this.token.ownerOf(firstTokenId + i);
              expect(res).deep.equal(this.to.address);
            }
          });

          it('transfer bulk of tokens to zero address', async function () {
            expect(await this.token.balanceOf(this.operator.address)).deep.equal(0);

            await this.token
              .connect(this.factoryOperator)
              .safeBulkTransferFrom(this.host.address, ZeroAddress, firstTokenId, firstTokenId + 4n);

            expect(await this.token.balanceOf(this.operator.address)).deep.equal(0);
            for (let i = 0n; i < 5n; i++) {
              const res = await this.token.ownerOf(firstTokenId + i);
              expect(res).deep.equal(this.host.address);
            }
          });
        });

        describe('by holder', function () {
          beforeEach(async function () {
            await this.token
              .connect(this.host)
              .safeBulkTransferFrom(this.host.address, this.to.address, firstTokenId, firstTokenId + 4n);
          });

          it('revert if fromId > toId', async function () {
            await expect(
              this.token
                .connect(this.to)
                .safeBulkTransferFrom(this.to.address, this.operator.address, firstTokenId + 2n, firstTokenId),
            ).revertedWithCustomError(this.token, 'InvalidTokenId');
          });

          it('revert if from is not token owner', async function () {
            await expect(
              this.token
                .connect(this.to)
                .safeBulkTransferFrom(this.host.address, this.operator.address, firstTokenId, firstTokenId + 2n),
            ).revertedWithCustomError(this.token, 'WrongFrom');
          });

          it('revert if sender is not operator', async function () {
            await expect(
              this.token
                .connect(this.host)
                .safeBulkTransferFrom(this.to.address, this.operator.address, firstTokenId, firstTokenId + 2n),
            ).revertedWithCustomError(this.token, 'Unauthorized');
          });

          it('transfer bulk of tokens to non-zero address', async function () {
            await this.token
              .connect(this.to)
              .safeBulkTransferFrom(this.to.address, this.operator.address, firstTokenId, firstTokenId + 4n);

            expect(await this.token.balanceOf(this.to.address)).deep.equal(0);
            expect(await this.token.balanceOf(this.operator.address)).deep.equal(5);
            for (let i = 0n; i < 5n; i++) {
              const res = await this.token.ownerOf(firstTokenId + i);
              expect(res).deep.equal(this.operator.address);
            }
          });

          it('transfer bulk of tokens to zero address', async function () {
            await this.token
              .connect(this.to)
              .safeBulkTransferFrom(this.to.address, ZeroAddress, firstTokenId, firstTokenId + 4n);

            expect(await this.token.balanceOf(this.to.address)).deep.equal(0);
            for (let i = 0n; i < 5n; i++) {
              const owner = await this.token.ownerOf(firstTokenId + i);
              expect(owner).deep.equal(this.host.address);
            }
          });
        });
      });
    });

    describe('approve', function () {
      const tokenId = firstTokenId;

      const itClearsApproval = function () {
        it('clears approval for the token', async function () {
          expect(await this.token.getApproved(tokenId)).to.equal(ethers.ZeroAddress);
        });
      };

      const itApproves = function () {
        it('sets the approval for the target address', async function () {
          expect(await this.token.getApproved(tokenId)).to.equal(this.approved ?? this.approved);
        });
      };

      const itEmitsApprovalEvent = function () {
        it('emits an approval event', async function () {
          await expect(this.tx)
            .to.emit(this.token, 'Approval')
            .withArgs(this.owner, this.approved ?? this.approved, tokenId);
        });
      };

      it('revert if spender is token owner', async function () {
        await expect(this.token.connect(this.host).approve(this.host, tokenId)).revertedWithCustomError(
          this.token,
          'ApprovalExisted',
        );
      });

      describe('when clearing approval', function () {
        describe('when there was no prior approval', function () {
          beforeEach(async function () {
            this.owner = this.host;
            this.approved = ZeroAddress;
            this.tx = await this.token.connect(this.owner).approve(this.approved, tokenId);
          });

          itClearsApproval();
          itEmitsApprovalEvent();
        });

        describe('when there was a prior approval', function () {
          beforeEach(async function () {
            this.owner = this.host;
            await this.token.connect(this.owner).approve(this.other, tokenId);
            this.approved = ethers.ZeroAddress;
            this.tx = await this.token.connect(this.owner).approve(this.approved, tokenId);
          });

          itClearsApproval();
          itEmitsApprovalEvent();
        });
      });

      describe('when approving a non-zero address', function () {
        describe('when there was no prior approval', function () {
          beforeEach(async function () {
            this.owner = this.host;
            this.tx = await this.token.connect(this.owner).approve(this.approved, tokenId);
          });

          itApproves();
          itEmitsApprovalEvent();
        });

        describe('when there was a prior approval to the same address', function () {
          beforeEach(async function () {
            this.owner = this.host;
            await this.token.connect(this.owner).approve(this.approved, tokenId);
            this.tx = await this.token.connect(this.owner).approve(this.approved, tokenId);
          });

          itApproves();
          itEmitsApprovalEvent();
        });

        describe('when there was a prior approval to a different address', function () {
          beforeEach(async function () {
            this.owner = this.host;
            await this.token.connect(this.owner).approve(this.other, tokenId);
            this.tx = await this.token.connect(this.owner).approve(this.approved, tokenId);
          });

          itApproves();
          itEmitsApprovalEvent();
        });
      });

      describe('when the sender does not own the given token ID', function () {
        it('reverts', async function () {
          await expect(this.token.connect(this.other).approve(this.approved, tokenId)).revertedWithCustomError(
            this.token,
            'Unauthorized',
          );
        });
      });

      describe('when the sender is approved for the given token ID', function () {
        it('reverts', async function () {
          this.owner = this.host;
          await this.token.connect(this.owner).approve(this.approved, tokenId);

          await expect(this.token.connect(this.approved).approve(this.other, tokenId)).revertedWithCustomError(
            this.token,
            'Unauthorized',
          );
        });
      });

      describe('when the sender is an operator', function () {
        beforeEach(async function () {
          this.owner = this.host;
          await this.token.connect(this.owner).setApprovalForAll(this.operator, true);

          this.tx = await this.token.connect(this.operator).approve(this.approved, tokenId);
        });

        itApproves();
        itEmitsApprovalEvent();
      });
    });

    describe('setApprovalForAll', function () {
      describe('when the operator willing to approve is not the owner', function () {
        describe('when there is no operator approval set by the sender', function () {
          it('approves the operator', async function () {
            await this.token.connect(this.owner).setApprovalForAll(this.operator, true);

            expect(await this.token.isApprovedForAll(this.owner, this.operator)).true;
          });

          it('emits an approval event', async function () {
            await expect(this.token.connect(this.owner).setApprovalForAll(this.operator, true))
              .to.emit(this.token, 'ApprovalForAll')
              .withArgs(this.owner, this.operator, true);
          });
        });

        describe('when the operator was set as not approved', function () {
          beforeEach(async function () {
            await this.token.connect(this.owner).setApprovalForAll(this.operator, false);
          });

          it('approves the operator', async function () {
            await this.token.connect(this.owner).setApprovalForAll(this.operator, true);

            expect(await this.token.isApprovedForAll(this.owner, this.operator)).true;
          });

          it('emits an approval event', async function () {
            await expect(this.token.connect(this.owner).setApprovalForAll(this.operator, true))
              .to.emit(this.token, 'ApprovalForAll')
              .withArgs(this.owner, this.operator, true);
          });

          it('can unset the operator approval', async function () {
            await this.token.connect(this.owner).setApprovalForAll(this.operator, false);

            expect(await this.token.isApprovedForAll(this.owner, this.operator)).false;
          });
        });

        describe('when the operator was already approved', function () {
          beforeEach(async function () {
            await this.token.connect(this.owner).setApprovalForAll(this.operator, true);
          });

          it('keeps the approval to the given address', async function () {
            await this.token.connect(this.owner).setApprovalForAll(this.operator, true);

            expect(await this.token.isApprovedForAll(this.owner, this.operator)).true;
          });

          it('emits an approval event', async function () {
            await expect(this.token.connect(this.owner).setApprovalForAll(this.operator, true))
              .to.emit(this.token, 'ApprovalForAll')
              .withArgs(this.owner, this.operator, true);
          });
        });
      });

      describe('when the operator is owner', function () {
        it('reverts', async function () {
          await expect(this.token.connect(this.owner).setApprovalForAll(this.owner, true)).revertedWithCustomError(
            this.token,
            'WrongOperator',
          );
        });
      });
    });

    describe('getApproved', function () {
      describe('when token hasnt been transferred for the first time', function () {
        it('should return the zero address', async function () {
          expect(await this.token.getApproved(firstTokenId)).deep.equal(ZeroAddress);
        });

        describe('when account has been approved', function () {
          it('returns approved account', async function () {
            const approved = this.otherAccounts[2].address;
            await this.token.connect(this.host).approve(this.otherAccounts[2].address, firstTokenId);
            expect(await this.token.getApproved(firstTokenId)).deep.equal(approved);
          });
        });
      });
    });
  });
}

export function shouldBehaveLikeERC721Metadata() {
  shouldSupportInterfaces(['ERC721Metadata']);

  describe('metadata', function () {
    it('has a name', async function () {
      expect(await this.token.name()).deep.equal(this.name);
    });

    it('has a symbol', async function () {
      expect(await this.token.symbol()).deep.equal(this.symbol);
    });

    describe('token URI', function () {
      describe('base URI', function () {
        beforeEach(function () {
          if (!this.token.interface.hasFunction('setBaseURI')) {
            this.skip();
          }
        });

        it('return empty token URI if baseTokenURI is empty', async function () {
          await this.token.connect(this.host).setBaseURI('');
          expect(await this.token.tokenURI(firstTokenId)).deep.equal('');
        });

        it('base URI can be set', async function () {
          await this.token.connect(this.host).setBaseURI(this.uri);
          expect(await this.token.baseTokenURI()).deep.equal(this.uri);
        });

        it('base URI is added as a prefix to the token URI', async function () {
          await this.token.connect(this.host).setBaseURI(this.uri);
          expect(await this.token.tokenURI(firstTokenId)).deep.equal(this.uri + firstTokenId.toString());
        });

        it('token URI can be changed by changing the base URI', async function () {
          await this.token.connect(this.host).setBaseURI(this.uri);
          const newBaseURI = 'https://api.example.com/v2/';
          await this.token.connect(this.host).setBaseURI(newBaseURI);
          expect(await this.token.tokenURI(firstTokenId)).deep.equal(newBaseURI + firstTokenId.toString());
        });
      });
    });
  });
}

module.exports = {
  shouldBehaveLikeERC721Booking,
  shouldBehaveLikeERC721Metadata,
};
