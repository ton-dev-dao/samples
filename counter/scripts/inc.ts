import { Address, toNano } from '@ton/core';
import { Counter } from '../wrappers/Counter';
import { NetworkProvider, sleep } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const counterAddress = Address.parse(args.length > 1 ? args[0] : await ui.input('Input counter address:'));

    const counter = provider.open(new Counter('Counter', counterAddress));

    const oldValue = (await counter.getCount({ user: provider.sender().address! })).qty;

    await counter.sendInc(provider.sender(), toNano(0.5));

    while (true) {
        const newValue = (await counter.getCount({ user: provider.sender().address! })).qty;
        if (newValue !== oldValue) {
            ui.write(`oldValue, newValue: ${oldValue} ${newValue}`);
            ui.write('Value is successfully increased!');
            break;
        }
        await sleep(1_000);
    }
}
