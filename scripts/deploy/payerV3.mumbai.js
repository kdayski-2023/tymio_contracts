const owner1 = '0x6Bd19dD6Bf58Fa1F2E6e6c1574C8E054c3e56690'
const owner2 = '0xE36490e9aEe2cCc6870F31706E358481b8ec5D6d'

async function main() {
    let accounts = await ethers.getSigners()
    const ownerAddress = accounts[0].address

    console.log(`${ownerAddress}: owner`);
    // const TestSwapRouter = await hre.ethers.getContractFactory('TestSwapRouter');
    // let testSwapRouter = await TestSwapRouter.deploy();
    // testSwapRouter = await testSwapRouter.deployed();
    // const testSwapRouterAddress = testSwapRouter.address;

    // console.log(`${testSwapRouterAddress}: testSwapRouter`);
    // 0x33b1662B7FE54FD9aeD79ae1D686c1D25E637CDB

    const settings = {
        usdcAddress: '0xDdE3f67f0A697B0f4633F4869F3E21135eb89156',
        usdtAddress: '0x759f126610C109641827bac698480B53A48DdD84',
        wbtcAddress: '0x624444B413199506E4879a5DC48249d4E0a2bC70',
        wethAddress: '0x2fCd10712dDd4DEDA1F24197A56c05458721Ed68',
        testSwapRouter: '0x33b1662B7FE54FD9aeD79ae1D686c1D25E637CDB'
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


    console.log('All contract settings are set');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
