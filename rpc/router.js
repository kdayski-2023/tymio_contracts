const ghre = require("hardhat")
const { spawn } = require("child_process")
const { Socket, io } = require("./lib/socket")
const validator = require("./lib/validator")
const socket = new Socket()
const deployments = require('../deployments')
const { getNetworkName } = require('../scripts/helpers/web3')
const fs = require('fs')


const Router = {
    tymio: {
        checkExpiration(args, callback) {
            console.log(args)
            networkName = getNetworkName(args.chainId)
            console.log("checkExpiration")
            socketLog(`🚀 go Faster then Light!`, args)
            const jsonData = JSON.stringify(args.data);
            fs.writeFileSync('./temp/data.json', jsonData, 'utf8', function (err) {
                if (err) {
                    return console.log(err);
                }
                console.log("The file was saved!");
            });
            let jsonPrices            

            if (args.prices != undefined) {
                jsonPrices = args.prices;
            } else {
                jsonPrices = JSON.parse(fs.readFileSync('./temp/defaultPrices.json', 'utf8'));
            }
            if(args.prices.WETH.sell !=undefined){
                jsonPrices.ETH = args.prices.WETH.sell.USDC
                jsonPrices.BTC = args.prices.WBTC.sell.USDC
            }
            fs.writeFileSync('./temp/prices.json', JSON.stringify(jsonPrices), 'utf8', function (err) {
                if (err) {
                    return console.log(err);
                }
                console.log("The file was saved!");
            });
            exec(`npx hardhat run ./scripts/adminPanel/rpcExpirationCheck.js --network ${networkName}`, args)
            callback(null, trace("exec started..."))
        }
    },
    rpc: {
        getNetworks(args, callback) {
            console.log("getNetworks")
            let networks = [...new Set(["twat", ...Object.keys(ghre.userConfig.networks)])]
            callback(null, networks)
        },
        getMethods(args, callback) {
            console.log("getMethods")
            const data = [
                {
                    title: "Окружение",
                    name: "env",
                    methods: [
                        {
                            title: "Получить текущее",
                            name: "getInfo",
                        },
                        {
                            title: "Получить сведения из ENS",
                            name: "getEnsInfo",
                            params: [
                                {
                                    title: "ENS address",
                                    name: "ens",
                                    type: "text",
                                },
                                {
                                    title: "domain",
                                    name: "domain",
                                    type: "text",
                                },
                            ],
                        },
                    ],
                },
                {
                    title: "RAW",
                    name: "rpc",
                    methods: [
                        {
                            title: "Send tx",
                            name: "sendRawTx",
                            params: [
                                {
                                    title: "To",
                                    name: "address",
                                    type: "text",
                                },
                                {
                                    title: "Value",
                                    name: "value",
                                    type: "text",
                                },
                                {
                                    title: "Data",
                                    name: "data",
                                    type: "text",
                                },
                            ],
                        },
                    ],
                },
            ]

            callback(null, data)
        },
        auth: (args, callback) => {
            console.log("auth")
            console.log(args)
            callback(null, trace("xxx"))
        },
    },
}
const exec = (cmd, params = {}) => {
    return new Promise((resolve, reject) => {
        const paramsArr = cmd.split(" ")
        paramsArr.slice(1)
        const socketClient = socket.connections.find((s) => s.sessionToken == params.sessionToken)
        const child = spawn(paramsArr[0], paramsArr.slice(1))
        let msg = ""
        child.stdout.on("data", (data) => {
            if (socketClient) socketClient.client.emit("log", data.toString())
            msg += data
        })

        child.stderr.on("data", (data) => {
            console.log(`stderr: ${data}`)
        })

        child.on("close", (code) => {
            resolve(msg)
        })
    })
}
const socketLog = (msg, params) => {
    const socketClient = socket.connections.find((s) => s.sessionToken == params.sessionToken)
    if (socketClient) socketClient.client.emit("log", msg)
}
const init = (params) => {
    const { network } = params
    const hre = Object.assign({}, ghre)
    hre.changeNetwork(network)
    const { ethers } = hre
    return { hre, ethers }
}
const trace = (message, params = {}) => {
    const { success = true } = params
    return { success, message }
}
function hexStringToByteArray(hexString) {
    if (hexString.length % 2 !== 0) {
        throw "Must have an even number of hex digits to convert to bytes"
    }
    var numBytes = hexString.length / 2
    var byteArray = new Uint8Array(numBytes)
    for (var i = 0; i < numBytes; i++) {
        byteArray[i] = parseInt(hexString.substr(i * 2, 2), 16)
    }
    return byteArray
}
async function signature(ethers, account, names, values) {
    const msg = ethers.utils.solidityPack(names, values)
    const hash = ethers.utils.keccak256(msg)
    const hashB = hexStringToByteArray(hash.substring(2))
    const s = await account.signMessage(hashB)
    return { hash: hash, signature: s }
}
module.exports = Router
