const hre = require("hardhat");

async function main() {
    try {

        const resVer = await hre.run("verify:verify", {
            address: "0x7729294B73B813147f9eaD7163853a136FBCbc1C"
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
