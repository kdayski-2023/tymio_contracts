const hre = require("hardhat");

async function main() {
    try {

        const resVer = await hre.run("verify:verify", {
            address: "0xB67D637B1301EEb56Dba4555bBd15Cd220F1aaD6"
        })
        console.log({ resVer })
    } catch (error) {
        console.log(error)
    }
}


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
