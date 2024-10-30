import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Counter } from '../wrappers/Counter';
import '@ton/test-utils';
import { compileSolidity, getContractBalance, randomKeyPair, stringifyJson } from '../helpers/common-utils';
import { KeyPair } from '@ton/crypto';

describe('Counter', () => {
    let blockchain: Blockchain;

    let code: Cell;
    let keyPair: KeyPair;
    let counter: SandboxContract<Counter>;
    let users: SandboxContract<TreasuryContract>[];

    beforeAll(async () => {
        code = await compileSolidity('Counter');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        // blockchain.verbosity.vmLogs = 'vm_logs_full';
        keyPair = await randomKeyPair();
        users = [
            await blockchain.treasury('user0'),
            await blockchain.treasury('user1'),
            await blockchain.treasury('user2'),
        ];
        const params = {
            _pubkey: `0x${keyPair.publicKey.toString('hex')}`,
            isAllowed: {
                [users[0].address.toRawString()]: true,
                [users[1].address.toRawString()]: true,
                [users[2].address.toRawString()]: true,
            },
        };
        counter = blockchain.openContract(await Counter.createFromABI('Counter', stringifyJson(params), code));
        const deployer = await blockchain.treasury('deployer');
        const deployResult = await counter.sendDeploy(deployer.getSender(), toNano('0.05'));
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: counter.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and counter are ready to use
    });

    it('should inc/grant', async () => {
        // Let's jump to the feature to test storage fee
        const now = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // seconds
        blockchain.now = now;

        // Test `inc` function
        const prevBalance = await getContractBalance(blockchain, counter.address);
        const result = await counter.sendInc(users[0].getSender(), toNano('0.05'));
        expect(result.transactions).toHaveTransaction({
            from: users[0].address,
            to: counter.address,
            success: true,
        });
        const newBalance = await getContractBalance(blockchain, counter.address);
        expect(newBalance).toBeGreaterThanOrEqual(prevBalance);
        let getCountResult = await counter.getCount({ user: users[0].address });
        expect(getCountResult.qty).toEqual(1n);

        // Test `grant` function
        const { body, expireAt } = await counter.makeGrantMessage(
            keyPair.secretKey,
            {
                time: now * 1000, // in ms
                lifetime: 10 * 60, // 10 min
            },
            {
                user: users[1].address,
                value: 10n,
            },
        );
        console.log('Message will expire at (seconds): ', expireAt);
        await counter.sendExternalMessage(body);
        getCountResult = await counter.getCount({ user: users[1].address });
        expect(getCountResult.qty).toEqual(10n);

        // Get state all contract state variables
        const vars = await counter.getStateVariables();
        console.log('State variables: ', vars);
    });
});
