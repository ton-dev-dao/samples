import { Address } from '@ton/core';
import { Counter } from '../wrappers/Counter';
import { NetworkProvider, sleep } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const counterAddress = Address.parse(args.length > 0 ? args[0] : await ui.input('Input counter address:'));
    const secretKey = args.length > 1 ? args[1] : await ui.input('Input contract secret key:');
    const userAddress = Address.parse(args.length > 2 ? args[2] : await ui.input('Input user address:'));
    const incValue = BigInt(args.length > 3 ? args[3] : await ui.input('Input inc value:'));

    const counter = provider.open(new Counter('Counter', counterAddress));

    const oldTime = BigInt((await counter.getStateVariables())._timestamp);
    const oldValue = (await counter.getCount({ user: userAddress })).qty;
    ui.write(`oldValue: ${oldValue}`);

    const startTime = Date.now();
    while (true) {
        const { body, expireAt } = await counter.makeGrantMessage(
            Buffer.from(secretKey, 'hex'),
            {
                time: Date.now(), // in ms
                lifetime: 60, // 1 min
            },
            {
                user: userAddress,
                value: incValue,
            },
        );
        console.log('Message will expire at (seconds): ', expireAt);
        await counter.sendExternalMessage(body);

        while (true) {
            await sleep(1_000);
            const newTime = BigInt((await counter.getStateVariables())._timestamp);
            if (newTime !== oldTime) {
                // The time in the contract changes. It means that the message was accepted.
                const newValue = (await counter.getCount({ user: provider.sender().address! })).qty;
                ui.write(`newValue: ${newValue}`);
                ui.write(`Finish in ${(Date.now() - startTime) / 1000} seconds.`);
                return;
            }
            if (Date.now() / 1000 >= expireAt) {
                // The message is expired. Let's create another and send one again.
                break;
            }
        }
    }
}
