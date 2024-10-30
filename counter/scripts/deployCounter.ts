import { Address, toNano } from '@ton/core';
import { Counter } from '../wrappers/Counter';
import { NetworkProvider } from '@ton/blueprint';
import { compileSolidity, randomKeyPair, stringifyJson } from '../helpers/common-utils';

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();

    const userQty = BigInt(await ui.input('Input user count:'));
    let allowedUsers: any = {};
    for (let i = 0; i < userQty; i += 1) {
        const userAddress = Address.parse(await ui.input('Input user address:'));
        allowedUsers[userAddress.toRawString()] = true;
    }

    const code = await compileSolidity('Counter');
    const keyPair = await randomKeyPair();
    const params = {
        _pubkey: `0x${keyPair.publicKey.toString('hex')}`,
        isAllowed: allowedUsers,
    };

    const counter = provider.open(await Counter.createFromABI('Counter', stringifyJson(params), code));

    await counter.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(counter.address);
    ui.write(`Contract secret key: ${keyPair.secretKey.toString('hex')}`);
    ui.write('Deployed successfully!');

    // run methods on `counter`

    // Get state all contract state variables
    const vars = await counter.getStateVariables();
    console.log('State variables: ', vars);
}

// Example of script output:
// Contract deployed at address EQA6IV0pylvO_7dSyoQGFrFsuhaeG1eXoqVfBA7-GZgdIR55
// You can view it at https://testnet.tonscan.org/address/EQA6IV0pylvO_7dSyoQGFrFsuhaeG1eXoqVfBA7-GZgdIR55
// Contract secret key: 20e6c3105d20b6cb27861e24f010115ace7fe7cb513e30c6eeaabc2577168e01d3087d357c0b85c83be335fbdda23d2e616b9aaf58229a315fd9fdfb79ed511e
