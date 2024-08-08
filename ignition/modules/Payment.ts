import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const PaymentModule = buildModule('PaymentModule', (m) => {
  const treasury = m.getParameter('_treasury', process.env.TREASURY_ADDRESS);
  const feeNumerator = m.getParameter('_feeNumerator', process.env.FEE_NUMERATOR);

  const payment = m.contract('Payment', [treasury, feeNumerator]);

  return { payment };
});

export default PaymentModule;
