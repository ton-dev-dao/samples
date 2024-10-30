import { Address, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';
import {
    buildData,
    decodeStateVariables,
    getter,
    sendInternalMessage,
    signedExternalBody,
    stringifyJson,
} from '../helpers/common-utils';

export class Counter implements Contract {
    constructor(
        readonly contract: string,
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static async createFromABI(contract: string, params: string, code: Cell, workchain = 0) {
        const data = await buildData(contract, params);
        const init = { code, data };
        return new Counter(contract, contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
        });
    }

    async sendInc(provider: ContractProvider, via: Sender, value: bigint) {
        await sendInternalMessage(provider, via, this.contract, 'inc', '{}', value);
    }

    async getCount(
        provider: ContractProvider,
        params: {
            user: Address;
        },
    ) {
        const p = stringifyJson(params);
        const res = await getter(provider, this.contract, 'getCount', p);
        return { qty: BigInt(res.qty) };
    }

    async makeGrantMessage(
        secretKey: Buffer,
        header: {
            time: number;
            lifetime?: number;
        },
        params: {
            user: Address;
            value: BigInt;
        },
    ) {
        const p = stringifyJson(params);
        return signedExternalBody(header, secretKey, this.address.toRawString(), this.contract, 'grant', p);
    }

    async sendExternalMessage(provider: ContractProvider, msg: Cell) {
        await provider.external(msg);
    }

    async getStateVariables(provider: ContractProvider) {
        return await decodeStateVariables(provider, this.contract);
    }
}
