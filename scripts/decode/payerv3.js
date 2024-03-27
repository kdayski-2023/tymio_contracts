const { filterTextKeys } = require('../helpers/web3')
const data = '0xbc66359e000000000000000000000000ff970a61a04b1ca14834a43f5de4533ebddb5cc800000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab1000000000000000000000000000000000000000000000000000000000aba9500000000000000000000000000000000000000000000000000000000000aba950000000000000000000000000000000000000000000000000000000000d693a4000000000000000000000000000000000000000000000000000000000000000001'
const payerV3Address = '0xB67D637B1301EEb56Dba4555bBd15Cd220F1aaD6'
async function main() {
    const payerV3 = await ethers.getContractAt("PayerV3", payerV3Address);
    let decodedData = payerV3.interface.parseTransaction({ data });
    // console.log(decodedData) // Log all data
    let decodedParams = filterTextKeys(decodedData.args)
    console.log(decodedData.name)
    console.log(decodedParams)
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
