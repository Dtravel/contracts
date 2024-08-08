import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const FactoryModule = buildModule('FactoryModule', (m) => {
  const operator = m.getParameter('_operator', process.env.OPERATOR_ADDRESS);
  const treasury = m.getParameter('_treasury', process.env.TREASURY_ADDRESS);
  const gasToken = m.getParameter('_tokenAddress', process.env.TOKEN_ADDRESS);
  const feeAmount = m.getParameter('_feeAmount', process.env.FEE_AMOUNT_PER_TRANSFER);

  const factory = m.contract('Factory', [operator, treasury, gasToken, feeAmount]);

  return { factory };
});

export default FactoryModule;
