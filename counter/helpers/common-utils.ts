import { Address, beginCell, Cell, ContractProvider, loadMessage, Sender, SendMode } from '@ton/core';
import path from 'path';
import fs from 'fs';
import util from 'util';
import { v4 as uuidv4 } from 'uuid';
import { Maybe } from '@ton/core/src/utils/maybe';
import { ContractState } from '@ton/core/src/contract/ContractState';
import { mnemonicNew, mnemonicToPrivateKey } from '@ton/crypto';
import { Blockchain } from '@ton/sandbox';
import { SmartContract } from '@ton/sandbox/dist/blockchain/SmartContract';

const exec = util.promisify(require('child_process').exec);

export async function runCommand(cmd: string) {
    try {
        const { stdout } = await exec(cmd);
        return { stdout };
    } catch (e) {
        console.error(e);
        throw e;
    }
}

function getFilePath(envName: string, defaultFilePath: string) {
    let filePath = process.env[envName];
    if (filePath === undefined) {
        filePath = defaultFilePath;
    }
    filePath = path.normalize(filePath);
    if (!fs.existsSync(filePath)) {
        const baseName = path.basename(filePath);
        throw new Error(`Can't find file "${baseName}". Set env variable "${envName}" to define a path to the file." `);
    }
    return filePath;
}

function getCompilerAndCli() {
    const SOLC_PATH = getFilePath('SOLC_PATH', './bin/solc');
    const ASM_PATH = getFilePath('ASM_PATH', './bin/asm');
    const STDLIB_PATH = getFilePath('STDLIB_PATH', './bin/stdlib_sol.tvm');
    const EVER_CLI = getFilePath('EVER_CLI', './bin/ever-cli');
    return { SOLC_PATH, ASM_PATH, STDLIB_PATH, EVER_CLI };
}

function getBocFile(contract: string) {
    const path = `./temp/${contract}.boc`;
    ensureDirectoryExistence(path);
    return path;
}

export async function compileSolidity(contract: string) {
    const { SOLC_PATH, ASM_PATH, STDLIB_PATH } = getCompilerAndCli();

    const contractPath = path.normalize(path.resolve('contracts', contract + '.sol'));

    await runCommand(`${SOLC_PATH} ${contractPath} --output-dir contracts --base-path=./contracts --tvm-version ton`);
    const boc_file = getBocFile(contract);
    await runCommand(`${ASM_PATH} ${STDLIB_PATH} --boc ${boc_file} ./contracts/${contract}.code`);
    fs.unlinkSync('output.debug.json');
    fs.renameSync(`./contracts/${contract}.code`, `./temp/${contract}.code`);

    const stateInitBoc = fs.readFileSync(boc_file, { encoding: 'base64' });
    const stateInit = Cell.fromBase64(stateInitBoc);
    // return only code of the contract
    return stateInit.refs[0]!;
}

export async function buildData(contract: string, params: string) {
    let { EVER_CLI } = getCompilerAndCli();
    const bocFile = getBocFile(contract);
    const newBocFile = getRandPath();
    fs.copyFileSync(bocFile, newBocFile);
    await runCommand(`${EVER_CLI} \
genaddr \
${newBocFile} \
--abi contracts/${contract}.abi.json \
--save \
--wc 0 \
--data '${params}'`);
    const stateInitBoc = fs.readFileSync(newBocFile, { encoding: 'base64' });
    const stateInit = Cell.fromBase64(stateInitBoc);
    fs.unlinkSync(newBocFile);
    // return only data of the contract
    return stateInit.refs[1]!;
}

async function callDecodeStateVariables(contract: string, bocPath: string) {
    let { EVER_CLI } = getCompilerAndCli();
    const stdout = (
        await runCommand(`${EVER_CLI} \
-j decode account data \
--abi contracts/${contract}.abi.json \
--tvc ${bocPath}`)
    ).stdout;
    return JSON.parse(stdout);
}

export async function decodeStateVariables(provider: ContractProvider, contract: string) {
    const bocPath = await saveStateToFile(await provider.getState());
    const result = await callDecodeStateVariables(contract, bocPath);
    fs.unlinkSync(bocPath);
    return result;
}

async function callGetter(bocPath: string, contract: string, method: string, params: string) {
    let { EVER_CLI } = getCompilerAndCli();
    const stdout = (
        await runCommand(`${EVER_CLI} \
-j run \
--tvc \
--abi contracts/${contract}.abi.json \
${bocPath} \
${method} \
'${params}'`)
    ).stdout;
    return JSON.parse(stdout);
}

function getRandPath() {
    const p = path.normalize(`./temp/states/${uuidv4()}.boc`);
    ensureDirectoryExistence(p);
    return p;
}

async function saveStateToFile(contractState: ContractState) {
    if (contractState.state.type !== 'active') {
        throw Error(' Contract is not active.');
    }
    const stateInit = createStateInit(
        cellFromBuffer(contractState.state.code!),
        cellFromBuffer(contractState.state.data!),
    );
    const stateInitBoc = stateInit.toBoc();
    const bocPath = getRandPath();
    writeToFile(bocPath, stateInitBoc);
    return bocPath;
}

export async function getter(provider: ContractProvider, contract: string, method: string, params: string) {
    const bocPath = await saveStateToFile(await provider.getState());
    const result = await callGetter(bocPath, contract, method, params);
    fs.unlinkSync(bocPath);
    return result;
}

export async function buildMessageBody(contract: string, functionName: string, params: string) {
    let { EVER_CLI } = getCompilerAndCli();
    const stdout = (
        await runCommand(`${EVER_CLI} \
-j body \
--abi 'contracts/${contract}.abi.json' \
${functionName} \
'${params}'`)
    ).stdout;
    let res = JSON.parse(stdout);
    return Cell.fromBase64(res.Message);
}

export async function signedExternalBody(
    header: {
        time: number;
        lifetime?: number;
    },
    secretKey: Buffer,
    address: string,
    contract: string,
    method: string,
    params: string,
) {
    let { EVER_CLI } = getCompilerAndCli();
    const stdout = (
        await runCommand(`${EVER_CLI} \
-j message \
--sign ${secretKey.toString('hex')} \
--abi 'contracts/${contract}.abi.json' \
--time '${header.time}' \
${header.lifetime === undefined ? '' : `--lifetime '${header.lifetime}'`} \
'${address}' \
${method} \
'${params}'`)
    ).stdout;
    let jsOutput = JSON.parse(stdout);
    let messageInfo = JSON.parse(Buffer.from(jsOutput.Message, 'hex').toString());
    let base64Message = messageInfo.msg.message;
    let decodedMessage = loadMessage(Cell.fromBase64(base64Message).asSlice());
    return {
        body: decodedMessage.body,
        expireAt: messageInfo.msg.expire as number,
    };
}

export function stringifyJson(x: any) {
    (Cell as any).prototype.toJSON = function () {
        return this.toBoc().toString('base64');
    };
    (Address as any).prototype.toJSON = function () {
        return this.toRawString();
    };
    return JSON.stringify(x, (_key, value) => {
        let valueType = typeof value;
        if (valueType === 'bigint') return value.toString();
        // else if (typeof value === 'object') {
        //     if (value.constructor.name == 'Cell') {
        //          return value.toBoc().toString('base64');
        //     }
        // }
        return value;
    });
}

export function cellFromBuffer(src: Buffer): Cell {
    let parsed = Cell.fromBoc(src);
    if (parsed.length !== 1) {
        throw new Error('Deserialized more than one cell');
    }
    return parsed[0];
}

export function createStateInit(code: Cell, data: Cell): Cell {
    return beginCell()
        .storeUint(0, 2) // split_depth:(Maybe (## 5)) special:(Maybe TickTock)
        .storeMaybeRef(code) // code:(Maybe ^Cell)
        .storeMaybeRef(data) // data:(Maybe ^Cell)
        .storeDict(null) // library:(HashmapE 256 SimpleLib)
        .endCell();
}

function ensureDirectoryExistence(filePath: string) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname, { recursive: true });
}

export function writeToFile(path: string, buffer: Buffer) {
    ensureDirectoryExistence(path);
    fs.writeFileSync(path, buffer);
}

export async function sendInternalMessage(
    provider: ContractProvider,
    via: Sender,
    contract: string,
    functionName: string,
    params: string,
    value: bigint | string,
    sendMode = SendMode.PAY_GAS_SEPARATELY,
    bounce?: Maybe<boolean>,
) {
    const body: Cell = await buildMessageBody(contract, functionName, params);
    await provider.internal(via, {
        value,
        bounce,
        sendMode: sendMode,
        body,
    });
}

export async function randomKeyPair() {
    let mnemonics = await mnemonicNew();
    return mnemonicToPrivateKey(mnemonics);
}

export async function getContractBalance(blockchain: Blockchain, address: Address) {
    const sc: SmartContract = await blockchain.getContract(address);
    return sc.balance;
}
