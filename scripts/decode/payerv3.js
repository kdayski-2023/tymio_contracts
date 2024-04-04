const { filterTextKeys } = require('../helpers/web3')
const data = '0xbb5c08fb0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000b67d637b1301eeb56dba4555bbd15cd220f1aad60000000000000000000000000000000000000000000000000000000000000001'
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
