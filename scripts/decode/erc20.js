const { filterTextKeys } = require('../helpers/web3')
const data = '0x095ea7b3000000000000000000000000b67d637b1301eeb56dba4555bbd15cd220f1aad600000000000000000000000000000000000000000000000000000002385e5b30'
async function main() {
    const priceProtectionV1 = await ethers.getContractAt("ERC20", '0xdac17f958d2ee523a2206206994597c13d831ec7');
    let decodedData = priceProtectionV1.interface.parseTransaction({ data });
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
