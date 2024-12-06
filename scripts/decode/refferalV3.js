const { filterTextKeys } = require('../helpers/web3')
const data = '0x2e1a7d4d0000000000000000000000000000000000000000000000000000000002461f70'
async function main() {
    const referralV3 = await ethers.getContractAt("ReferralV3", '0x7729294B73B813147f9eaD7163853a136FBCbc1C');
    let decodedData = referralV3.interface.parseTransaction({ data });
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
