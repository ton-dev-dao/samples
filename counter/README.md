# Counter

## Project structure

-   `contracts` - source code of all the smart contracts of the project and their dependencies.
-   `wrappers` - wrapper classes (implementing `Contract` from ton-core) for the contracts.
-   `tests` - tests for the contracts.
-   `scripts` - scripts used by the project, mainly the deployment scripts.

## How to use

### Install
```
npm install
npm i --save-dev @types/uuid
```

Put to directory `counter/bin`
 * [solc](https://github.com/ton-dev-dao/TVM-Solidity-Compiler)
 * [stdlib_sol.tvm](https://github.com/ton-dev-dao/TVM-Solidity-Compiler/blob/main/lib/stdlib_sol.tvm)
 * [asm](https://github.com/ton-dev-dao/ton-dev-assembler)
 * [ton-dev-cli](https://github.com/ton-dev-dao/ton-dev-cli)

You can build them or get from [release section](https://github.com/ton-dev-dao/TVM-Solidity-Compiler/releases).

### Test

`npx blueprint test` or `yarn blueprint test`

### Deploy or run another script

`npx blueprint run` or `yarn blueprint run`
