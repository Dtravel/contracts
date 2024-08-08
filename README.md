# Smart contracts V4

This repository contains the core smart contracts for Dtravel Booking Service, using **Nite Tokens**.

## Prerequisites

Node >= 20.x && yarn > 1.22.x

```
$ node --version
v20.5.0

$ yarn --version
1.22.22
```

Install dependencies

```
$ yarn
```

Install the [ESLint VS Code extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) and the [Prettier VS Code](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) extension to have code auto-fix on save.

## Unit test

1. Compile contract

```
$ yarn compile
```

2. Run tests

```
$ yarn test
```

## Test coverage

1. Run script

```
yarn test:coverage
```

## Deployment

1. Config `.env`

```
ADMIN_PRIVATE_KEY=
OPERATOR_ADDRESS=
TREASURY_ADDRESS=
TOKEN_ADDRESS=
FEE_AMOUNT_PER_TRANSFER=
FEE_NUMERATOR=
SCAN_API_KEY=
BASE_TESTNET_RPC=
BASE_MAINNET_RPC=
```

2. Deploy contracts

- Testnet:

```
yarn deploy:testnet
```

- Mainnet

```
yarn deploy:mainnet
```
