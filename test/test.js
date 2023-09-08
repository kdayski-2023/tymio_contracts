const { ethers } = require('hardhat')
const hre = require('hardhat')
const BN = web3.utils.BN;

let verbose = false
console.log(process.argv)
const log = (...args) => {
    if (verbose) {
        console.log(...args)
    }
}

let usdc,
    owner1,
    owner2,
    service,
    user1,
    user1Address,
    user1EthBalance,
    payer,
    params,
    usdcAddress,
    payerAddress,
    ERC20

params = {
    sendAmountUsd: 1000000,
    sendAmountEth: ethers.utils.parseEther("2.0"), // 1ETH
    createAmountUsd: 1000000,
    createAmountETH: ethers.utils.parseEther("1.0")
}
beforeEach(async () => {
    let accounts = await ethers.getSigners()
    owner1 = accounts[0]
    owner1Address = owner1.address
    owner2 = accounts[1]
    owner2Address = owner2.address
    service = accounts[1]
    serviceAddress = service.address
    user1 = accounts[2]
    user1Address = user1.address
    // log('owner1: ', owner1Address)
    // log('owner2: ', owner2Address)
    params.createInfo = [[user1Address], [params.createAmountETH], [user1Address], [params.createAmountUsd]]
})

describe('Payer', () => {
    it('Подготовка', async () => {
        ERC20 = await hre.ethers.getContractFactory('ERC20')
        usdc = await ERC20.deploy('USDC', 'USDC', 6, owner1Address)
        usdc = await usdc.deployed()
        await usdc.mint(owner1Address, 100000000)
        usdcAddress = usdc.address
        log(`Deployed ERC20 USDC ${usdcAddress}`)
        log('Deploying Payer...')
        const Payer = await hre.ethers.getContractFactory('PayerV2')
        payer = await Payer.deploy(usdcAddress)
        payer = await payer.deployed()
        payerAddress = payer.address
        user1EthBalance = await ethers.provider.getBalance(user1Address)
        log(`Payer: ${payerAddress}`)
    })

    it('Выдача прав сервису', async () => {
        const tx1 = await payer.setServiceAddress(serviceAddress)
        await tx1.wait()
    })
    it('Отправка сервисом информaции о выплатах', async () => {
        const tx1 = await payer.connect(service).create(...params.createInfo)
        await tx1.wait()
        expect(await payer.ethAddressCount()).to.equal(1)
    })
    it('Защита от повторной отправки сервисом информaции о выплатах', async () => {
        try {
            const tx1 = await payer.connect(service).create(...params.createInfo)
            await tx1.wait()
        } catch (error) {
            expect("VM Exception while processing transaction: reverted with reason string 'ALREADY RECORDED'").to.equal(error.message);
        }
    })
    it('Корректная запись о выплате в контаркте', async () => {
        const ethAddress = await payer.ethAddress2(0)
        const ethValue = await payer.ethValue2(0)
        const usdAddress = await payer.usdAddress2(0)
        const usdValue = await payer.usdValue2(0)
        expect(ethAddress).to.equal(params.createInfo[0][0].toString())
        expect(ethValue.toString()).to.equal(params.createInfo[1][0].toString())
        expect(usdAddress).to.equal(params.createInfo[2][0].toString())
        expect(usdValue.toString()).to.equal(params.createInfo[3][0].toString())
    })
    it('Отправка USD на контракт', async () => {
        await usdc.transfer(payerAddress, params.sendAmountUsd)
    })
    it('Отправка ETH на контракт', async () => {
        await owner1.sendTransaction({
            to: payerAddress,
            value: params.sendAmountEth,
        });
    })
    it('Баланс USD соответствует отправленному', async () => {
        expect((await payer.getUsdBalance()).toString()).to.equal(new BN(params.sendAmountUsd).toString())
    })
    it('Баланс ETH соответствует отправленному', async () => {
        expect(await payer.getEthBalance()).to.equal(params.sendAmountEth)
    })
    it('Достаточно средств в контаркте', async () => {
        expect(await payer.isEnoughPayoutAmount()).to.equal(true)
    })

    it('Выплата', async () => {
        const tx1 = await payer.makePayment()
        await tx1.wait()
    })
    it('Защита от повторной выплаты', async () => {
        try {
            const tx1 = await payer.makePayment()
            await tx1.wait()
        } catch (error) {
            expect("VM Exception while processing transaction: reverted with reason string 'ALREADY PAID'").to.equal(error.message);
        }
    })
    it('Корректные суммы у пользователей после выплаты', async () => {
        const userUsdBalance = await usdc.balanceOf(user1Address)
        const userEthBalance = await ethers.provider.getBalance(user1Address);
        expect(BigInt(userEthBalance) - BigInt(user1EthBalance)).to.equal(BigInt(params.createInfo[1][0]))
        expect(userUsdBalance.toString()).to.equal(params.createInfo[3][0].toString())
    })
    it('!Вернуть все средства ETH', async () => { })
    it('!Вернуть все средства USD', async () => { })
    it('!Проверка прав. Нельзя вызвать методы обычным пользовтелем', async () => { })
    it('!Проверка прав. Нельзя вызвать методы платежа сервисом', async () => { })
    it('!Проверка прав. Owner1 и Owner2 могут выполнять разрешенные методы', async () => { })
    it('!Проверка сеттеров. Установка нового адреса сервиса', async () => { })
    it('!Проверка сеттеров. Сброс состояния записи сервиса', async () => { })
    it('!Проверка сеттеров. Установка второго владельца', async () => { })
    it('!Проверка сеттеров. Установка второго владельца', async () => { })
})
