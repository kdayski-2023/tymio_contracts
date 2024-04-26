const { filterTextKeys } = require('../helpers/web3')
const data = '0xbb5c08fb0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000000000000000000'
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
