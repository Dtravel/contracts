import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const FactoryModule = buildModule('FactoryModule', (m) => {
  const operator = m.getParameter('operator', process.env.OPERATOR_ADDRESS);
  const factory = m.contract('Lock', [operator]);

  return { factory };
});

export default FactoryModule;
