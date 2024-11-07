const stage = 1 //сначала деплоим токены и роутер = 1 , priceProtection = 2

const log = (...args) => {
    console.log(...args);
};

async function main() {
    let accounts = await ethers.getSigners()
    const ownerAddress = accounts[0].address

    log(`${ownerAddress}: owner`);

    const settings = {
        usdcAddress: '0x1DDC824D3af1f7d6c13eE9307817111A75D04520',
        usdtAddress: '0xc588e6a573E691650Ab01f6Cf01950a606eDB6b5'
    }

    const PriceProtection = await hre.ethers.getContractFactory('PriceProtectionV1');
    let priceProtection = await PriceProtection.deploy();
    priceProtection = await priceProtection.deployed();
    const priceProtectionAddress = priceProtection.address;
    log(`${priceProtectionAddress}: priceProtectionV3`);
    tx = await priceProtection.editAcceptableToken(settings.usdcAddress, true,  "10000000");
    await tx.wait();
    tx = await priceProtection.editAcceptableToken(settings.usdtAddress, true, "10000000");
    await tx.wait();

    log('All contract settings are set');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
