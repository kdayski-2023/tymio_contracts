const owner1 = '0x6Bd19dD6Bf58Fa1F2E6e6c1574C8E054c3e56690'
const owner2 = '0xE36490e9aEe2cCc6870F31706E358481b8ec5D6d'

async function main() {
    let accounts = await ethers.getSigners()
    const ownerAddress = accounts[0].address

    console.log(`${ownerAddress}: owner`);

    const settings = {
        usdcAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        wethAddress: '0x4200000000000000000000000000000000000006'
    }

    const Payer = await hre.ethers.getContractFactory('PayerV3');
    let payer = await Payer.deploy();
    payer = await payer.deployed();
    const payerAddress = payer.address;
    console.log(`${payerAddress}: PayerV3`);
    tx = await payer.editAcceptableToken(settings.usdcAddress, true, true, "10000000");
    await tx.wait();
    tx = await payer.editAcceptableToken(settings.wethAddress, true, false, "2600000000000000");
    await tx.wait();
    tx = await payer.setOwner2Address(owner2);
    await tx.wait();
    tx = await payer.setOwner1Address(owner1);
    await tx.wait();

    console.log('All contract settings are set');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
