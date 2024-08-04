import { expect } from 'chai';
import { getInterfaceId, mapValues } from './helpers';

interface Signatures {
  [key: string]: string[]; // Index signature for dynamic keys
}
const INVALID_ID = '0xffffffff';
const SIGNATURES: Signatures = {
  ERC165: ['supportsInterface(bytes4)'],
  ERC721: [
    'balanceOf(address)',
    'ownerOf(uint256)',
    'approve(address,uint256)',
    'getApproved(uint256)',
    'setApprovalForAll(address,bool)',
    'isApprovedForAll(address,address)',
    'transferFrom(address,address,uint256)',
    'safeTransferFrom(address,address,uint256)',
    'safeTransferFrom(address,address,uint256,bytes)',
  ],
  ERC721Metadata: ['name()', 'symbol()', 'tokenURI(uint256)'],
};

const INTERFACE_IDS = mapValues(SIGNATURES, getInterfaceId);

export function shouldSupportInterfaces(interfaces: string[] = []) {
  interfaces.unshift('ERC165');

  describe(`supports: ${interfaces.join(' - ')}`, function () {
    beforeEach(function () {
      this.contractUnderTest = this.token;
    });

    describe('when the interfaceId is supported', function () {
      it('uses less than 30k gas', async function () {
        for (const k of interfaces) {
          const interfaceId = INTERFACE_IDS[k] ?? k;
          expect(await this.contractUnderTest.supportsInterface.estimateGas(interfaceId)).to.lte(30_000n);
        }
      });

      it('returns true', async function () {
        for (const k of interfaces) {
          const interfaceId = INTERFACE_IDS[k] ?? k;
          expect(await this.contractUnderTest.supportsInterface(interfaceId), `does not support ${k}`).to.be.true;
        }
      });
    });

    describe('when the interfaceId is not supported', function () {
      it('uses less than 30k', async function () {
        expect(await this.contractUnderTest.supportsInterface.estimateGas(INVALID_ID)).to.lte(30_000n);
      });

      it('returns false', async function () {
        expect(await this.contractUnderTest.supportsInterface(INVALID_ID), `supports ${INVALID_ID}`).to.be.false;
      });
    });

    it('all interface functions are in ABI', async function () {
      for (const k of interfaces) {
        // skip interfaces for which we don't have a function list
        if (SIGNATURES[k] === undefined) continue;

        // Check the presence of each function in the contract's interface
        for (const fnSig of SIGNATURES[k]) {
          expect(this.contractUnderTest.interface.hasFunction(fnSig), `did not find ${fnSig}`).to.be.true;
        }
      }
    });
  });
}

export default {
  shouldSupportInterfaces,
};
