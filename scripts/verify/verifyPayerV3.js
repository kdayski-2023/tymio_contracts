const hre = require("hardhat");

async function main() {
    try {

        const resVer = await hre.run("verify:verify", {
            address: "0x7C0ba77617625D3CfFfd60D0F9199afbdD50962C"
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
