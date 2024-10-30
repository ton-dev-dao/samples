import { Address } from '@ton/core';
import { Counter } from '../wrappers/Counter';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const counterAddress = Address.parse(args.length > 0 ? args[0] : await ui.input('Input counter address:'));

    const counter = provider.open(new Counter('Counter', counterAddress));

    const vars = await counter.getStateVariables();
    console.log('State variables: ', vars);
}
