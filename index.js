import { ApiPromise, WsProvider } from '@polkadot/api';

import { argv } from 'node:process';

let chain;

argv.filter((val) => {
    const parsedVal = val.split("=");
    if (parsedVal[0] === 'chain') {
        switch (parsedVal[1]) {
            case 'polkadot':
                chain = 'polkadot';
                break;
            case 'westend':
                chain = 'westend';
                break;
            case 'rococo':
                chain = 'rococo';
                break;
            default:
                chain = 'kusama';
        }
    }
});

const convertToNumber = (data) => {
    return Number(data.split(",").join(""));
}

const buildApi = async (chain) => {
    let api
    switch (chain){
        case 'polkadot':
            const wsProviderPolkadot = new WsProvider('wss://rpc.polkadot.io');
            api = await ApiPromise.create({ provider: wsProviderPolkadot });  
        case 'westend':
            const wsProviderWestend = new WsProvider('wss://westend-rpc.polkadot.io');
            api = await ApiPromise.create({ provider: wsProviderWestend });  
            break;
        case 'rococo':
            const wsProviderRococo = new WsProvider('wss://rococo-rpc.polkadot.io');
            api = await ApiPromise.create({ provider: wsProviderRococo });  
            break;
        default:
            const wsProviderKusama = new WsProvider('wss://kusama-rpc.polkadot.io');
            api = await ApiPromise.create({ provider: wsProviderKusama });  
            break;
    }
    return api
}

const api = await buildApi(chain);

async function main() {

    const INCIDENT_BLOCK = 19485524;

    const allParas = async function () {
        const parasRawInfo = await api.query.registrar.paras.entries()
        const allParasInfo = [];
        parasRawInfo.forEach(([{ args: [paraID] }, paraInfo]) => {
            const humanParaID = paraID.toHuman();
            const humanparaInfo = paraInfo.toHuman();
            allParasInfo.push({humanParaID, ...humanparaInfo})

        });
        return allParasInfo
    }

    //gets list of parachains
    const currentParachains = async function () {
        return (await api.query.paras.parachains()).toHuman();
    }

    //gets last block para-relay
    const hrmpWatermark = async function () {
        const allLastBlocks = await api.query.hrmp.hrmpWatermarks.entries();
        const allLastBlocksInfo = [];
        allLastBlocks.forEach(([{ args: [paraID] }, block]) => {
            const humanParaID = paraID.toHuman();
            const humanBlock = block.toHuman();
            allLastBlocksInfo.push([humanParaID,humanBlock])
        });
        return allLastBlocksInfo
    }

    //PRINT
    const current_parachains = await currentParachains();
    const paras_info = await allParas()
    const hrmp_info = await hrmpWatermark()
    const paraFullInfo = paras_info.map(para => {
        const newParaInfo = {...para}
        if(current_parachains.includes(para.humanParaID)){
            newParaInfo.isParachain = true
        }else{
            newParaInfo.isParachain = false
        }
        hrmp_info.map(data => {
            const last_block_produced = convertToNumber(data[1]);
            if(data[0] === para.humanParaID){
                newParaInfo.lastBlock = last_block_produced;
                if(last_block_produced >= INCIDENT_BLOCK){
                    newParaInfo.producedAfterIncident = true;
                }else{
                    newParaInfo.producedAfterIncident = false;
                }
            }
        })

        return newParaInfo
    })

    const onlyParas = paraFullInfo.filter(para => para.isParachain)
    const onlyParasNotProducing = paraFullInfo.filter(para => (para.isParachain && !para.producedAfterIncident))
    console.log(onlyParas)
    console.log("PARAS NOT PRODUCING BLOCKS")
    console.log(onlyParasNotProducing)
}



main().catch(console.error).finally(() => process.exit());