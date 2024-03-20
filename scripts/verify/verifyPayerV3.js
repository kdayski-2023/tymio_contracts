const hre = require("hardhat");

async function main() {
    try {

        const resVer = await hre.run("verify:verify", {
            address: "0x5814Ebbc6aE6040E631EE3Ec16353380E571818a"
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
