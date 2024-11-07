const stage = 1 //сначала деплоим токены и роутер = 1 , priceProtection = 2

const log = (...args) => {
    console.log(...args);
};

async function main() {
    const owner1 = '0x6Bd19dD6Bf58Fa1F2E6e6c1574C8E054c3e56690'
    const owner2 = '0xE36490e9aEe2cCc6870F31706E358481b8ec5D6d'
    let accounts = await ethers.getSigners()
    const ownerAddress = accounts[0].address

    log(`${ownerAddress}: owner`);

    const settings = {
        usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        usdtAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'
    }

    const PriceProtection = await hre.ethers.getContractFactory('PriceProtectionV1');
    let priceProtection = await PriceProtection.deploy();
    priceProtection = await priceProtection.deployed();
    const priceProtectionAddress = priceProtection.address;
    log(`${priceProtectionAddress}: priceProtectionV3`);
    tx = await priceProtection.editAcceptableToken(settings.usdcAddress, true,  "1000000");
    await tx.wait();
    tx = await priceProtection.editAcceptableToken(settings.usdtAddress, true, "1000000");
    await tx.wait();
    tx = await priceProtection.setOwner2Address(owner2);
    await tx.wait();
    tx = await priceProtection.setOwner1Address(owner1);
    await tx.wait();

    log('All contract settings are set');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
