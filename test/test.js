const { ethers } = require('hardhat')
const hre = require('hardhat')
const BN = web3.utils.BN;

let verbose = false
const log = (...args) => {
    if (verbose) {
        console.log(...args)
    }
}

let usdc,
    weth9,
    wbtc,
    owner1,
    owner2,
    service,
    user1,
    user1Address,
    user1EthBalance,
    payer,
    user2,
    user2Address,
    user2EthBalance,
    user3,
    user3Address,
    user3EthBalance,
    params,
    usdcAddress,
    weth9Address,
    wbtcAddress,
    payerAddress,
    ERC20

params = {
    diferentUserAddress: "0xC601587108f1ae01323f0dBa248DE436fa6BBC5e", 
    zero: "0x0000000000000000000000000000000000000000",
    sendAmountErc20: 1000000,
    sendAmountEth: ethers.utils.parseEther("1.0"), // 1ETH
    createAmountErc20: new BN("1000000").toString(),
    createAmountETH: ethers.utils.parseEther("1.0"),
    acceptableTokens: [],
    createInfo: []
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
    user2 = accounts[3]
    user2Address = user2.address
    user3 = accounts[4]
    user3Address = user3.address
})
describe('Payer', () => {
    it('Подготовка', async () => {        
        user3EthBalance = await web3.eth.getBalance(user3Address)
        const ERC20 = await hre.ethers.getContractFactory('ERC20')
        usdc = await ERC20.deploy('USDC', 'USDC', 6, owner1Address)
        usdc = await usdc.deployed()
        await usdc.mint(owner1Address, 100000000)
        usdcAddress = usdc.address
        log(`Deployed USDC ${usdcAddress}`)

        const WBTC = await hre.ethers.getContractFactory('ERC20')
        wbtc = await WBTC.deploy('WBTC', 'WBTC', 6, owner1Address)
        wbtc = await wbtc.deployed()
        await wbtc.mint(owner1Address, 100000000)
        wbtcAddress = wbtc.address
        log(`Deployed WBTC ${wbtcAddress}`)

        WETH9 = await hre.ethers.getContractFactory('WETH9')
        weth9 = await WETH9.deploy()
        weth9 = await weth9.deployed()
        weth9Address = weth9.address
        log(`Deployed WETH9 ${weth9Address}`)
        
       
                                        
        log('Deploying Payer...')
        const Payer = await hre.ethers.getContractFactory('PayerV2')
        payer = await Payer.deploy()
        payer = await payer.deployed()
        payerAddress = payer.address

        await payer.editAcceptableToken(usdcAddress, true)
        params.acceptableTokens.push(usdcAddress)

        await payer.editAcceptableToken(wbtcAddress, true)
        params.acceptableTokens.push(wbtcAddress)
        
        await payer.editAcceptableToken(weth9Address, true)
        params.acceptableTokens.push(weth9Address)
        
        await payer.editAcceptableToken(params.zero, true)
        params.acceptableTokens.push(params.zero)
        

        user1EthBalance = await ethers.provider.getBalance(user1Address)
        log(`Payer: ${payerAddress}`)

        params.createInfo = [
            [params.acceptableTokens[0],params.acceptableTokens[1],params.acceptableTokens[3]], 
            [params.createAmountErc20, params.createAmountErc20, params.createAmountETH], 
            [user1Address, user2Address, user3Address]]
    })

    it('Выдача прав сервису', async () => {
        const tx1 = await payer.setServiceAddress(serviceAddress)
        await tx1.wait()
        expect(await payer.service()).to.equal(serviceAddress)
    })
    it('Отправка сервисом информaции о выплатах', async () => {
        const tx1 = await payer.connect(service).create(...params.createInfo)
        await tx1.wait()
        expect(await payer.recordCount()).to.equal(params.createInfo.length)
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
        const tokenAddress = await payer.tokenAddress(0)
        const amount = await payer.amount(0)
        const userAddress = await payer.userAddress(0)
        // TODO сделать проверку в цикле по всем записям массива 
        expect(tokenAddress).to.equal(params.createInfo[0][0].toString())
        expect(amount.toString()).to.equal(params.createInfo[1][0].toString())
        expect(userAddress).to.equal(params.createInfo[2][0].toString())
    })
    it('Отправка USDC на контракт', async () => {
        let tx = await usdc.transfer(payerAddress, params.sendAmountErc20)
        await tx.wait()
        expect(Number(await usdc.balanceOf(payerAddress))).to.equal(Number(params.sendAmountErc20))
    })
    it('Отправка WBTC на контракт', async () => {
        let tx = await wbtc.transfer(payerAddress, params.sendAmountErc20)
        await tx.wait()
        expect(Number(await wbtc.balanceOf(payerAddress))).to.equal(Number(params.sendAmountErc20))
    })
    it('Отправка ETH на контракт', async () => {
        await owner1.sendTransaction({
            to: payerAddress,
            value: params.sendAmountEth,
        });
    })
    it('Баланс USDC соответствует отправленному', async () => {
        expect(await usdc.balanceOf(payerAddress)).to.equal(new BN(params.sendAmountErc20).toString())
    })
    it('Баланс WBTC соответствует отправленному', async () => {
        expect(await wbtc.balanceOf(payerAddress)).to.equal(new BN(params.sendAmountErc20).toString())
    })
    it('Баланс ETH соответствует отправленному', async () => {
        expect(await web3.eth.getBalance(payerAddress)).to.equal(params.sendAmountEth)
    })
    it('Достаточно средств в контаркте', async () => {
        // /expect(await payer.isEnoughPayoutAmount()).to.equal(true)
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
        expect(await usdc.balanceOf(user1Address)).to.equal(params.sendAmountErc20)
        expect(await wbtc.balanceOf(user2Address)).to.equal(params.sendAmountErc20)
        expect(Number(await web3.eth.getBalance(user3Address))).to.equal(Number(params.sendAmountEth.toString()) + Number(user3EthBalance))
    })
    it('Вернуть все средства ETH', async () => { 
        await owner1.sendTransaction({
            to: payerAddress,
            value: params.sendAmountEth,
        });
        let tx = await payer.getBackEth(params.diferentUserAddress, await web3.eth.getBalance(payerAddress))
        await tx.wait()
        expect(Number(await web3.eth.getBalance(params.diferentUserAddress))).to.equal(Number(params.sendAmountEth))
        expect(Number(await web3.eth.getBalance(payerAddress))).to.equal(0)
    })
    it('Вернуть все средства USDC', async () => { 


    })
    it('Проверка прав. Нельзя вызвать методы обычным пользовтелем', async () => {
        // create
        const errorMessage = "VM Exception while processing transaction: reverted with reason string 'NOT THE ALLOWED ADDRESS'"
        const errorMessage2 = "VM Exception while processing transaction: reverted with reason string 'NOT THE OWNERS'"
        try {
            const tx1 = await payer.connect(user3).create(...params.createInfo)
            await tx1.wait()
        } catch (error) {
            expect(errorMessage).to.equal(error.message);
        }
        //getBackEth
        try {
            const tx1 = await payer.connect(user3).getBackEth(params.diferentUserAddress, await web3.eth.getBalance(payerAddress))
            await tx1.wait()
        } catch (error) {
            expect(errorMessage2).to.equal(error.message);
        }
        //getBackErc20
        try {
            const tx1 = await payer.connect(user3).getBackErc20(params.diferentUserAddress, params.diferentUserAddress, await web3.eth.getBalance(payerAddress))
            await tx1.wait()
        } catch (error) {
            expect(errorMessage2).to.equal(error.message);
        }
     })
    it('Проверка прав. Нельзя вызвать методы платежа сервисом', async () => {
        const errorMessage = "VM Exception while processing transaction: reverted with reason string 'NOT THE OWNERS'"
        try {
            const tx1 = await payer.connect(service).create(...params.createInfo)
            await tx1.wait()
            const tx2 = await payer.connect(service).makePayment()
            await tx2.wait()
        } catch (error) {
            expect(errorMessage).to.equal(error.message);
        }
     })

    it('Проверка сеттеров. Установка нового адреса сервиса', async () => { 
        const tx1 = await payer.setServiceAddress(user3Address)
        await tx1.wait()
        expect(await payer.service()).to.equal(user3Address)
    })
    it('Проверка сеттеров. Сброс состояния о записи сервиса', async () => { 
        let recorded = await payer.recorded()
        const tx1 = await payer.setRecorded(false)
        await tx1.wait()
        expect(await payer.recorded()).to.equal(false)
    })
    it('Проверка сеттеров. Сброс состояния о выплате сервиса', async () => { 
        let paid = await payer.paid()
        const tx1 = await payer.setPaid(true)
        await tx1.wait()
        expect(await payer.paid()).to.equal(true)
    })
    it('Проверка сеттеров. Установка второго владельца', async () => {
        let tx = await payer.setOwner2Address(owner2Address)
        await tx.wait()
        expect(await payer.owner2()).to.equal(owner2Address)
     })
})
