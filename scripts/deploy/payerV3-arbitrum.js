const owner1 = '0x6Bd19dD6Bf58Fa1F2E6e6c1574C8E054c3e56690'
const owner2 = '0xE36490e9aEe2cCc6870F31706E358481b8ec5D6d'

async function main() {
    let accounts = await ethers.getSigners()
    const ownerAddress = accounts[0].address

    console.log(`${ownerAddress}: owner`);

    const settings = {
        usdcAddress: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
        usdtAddress: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
        wbtcAddress: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
        wethAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
    }

    const Payer = await hre.ethers.getContractFactory('PayerV3');
    let payer = await Payer.deploy();
    payer = await payer.deployed();
    const payerAddress = payer.address;
    console.log(`${payerAddress}: PayerV3`);
    tx = await payer.editAcceptableToken(settings.usdcAddress, true, true, "10000000");
    await tx.wait();
    tx = await payer.editAcceptableToken(settings.usdtAddress, true, true, "10000000");
    await tx.wait();
    tx = await payer.editAcceptableToken(settings.wethAddress, true, false, "2600000000000000");
    await tx.wait();
    tx = await payer.editAcceptableToken(settings.wbtcAddress, true, false, "14285");
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
