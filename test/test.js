const { expect } = require('chai');
const Web3 = require('web3');
const expirationsOriginal = require('../assets/expirationProtect.json');
const { cToken, sToken, wait } = require('../test/utils');
const {
	getAdditionalAmount,
	postOrders,
	replaceUserAddresses,
	executeOrders,
	claimOrders,
	fullWithdrawal,
	getArgsForExecuteOrders,
	setRatio,
	setAcceptableTokens,
	getSwapsOutMinimal,
	deployTokens,
	deploySwapRouter,
	deployPayer,
	mintTokens,
	getSigners,
	setAdditionalAmountToContract,
	checkContractBalances,
	sendEthForTransfer,
	checkEmptyBalances,
	tokensV1,
	getCurrentBlockTimestamp
} = require('../test/protect');

const BN = Web3.utils.BN;

let owner1,
	owner2,
	service,
	users,
	tokens,
	swapRouter,
	payer,
	tokensV3,
	expiration,
	signers,
	ethBalance;
let expirations = expirationsOriginal;

describe('Expiration', async () => {
	it('Deploy contracts', async () => {
		tokens = await deployTokens(['USDT', 'USDC']);
		payer = await deployPayer('PriceProtectionV1');
	});
	it('Prepare contract for expiration', async () => {
		expiration = expirations[1];
		tokens.USDC.minimalAmount = "1000000"
		tokens.USDT.minimalAmount = "1000000"
		tokensV3 = {
			USDC: tokens.USDC,
			USDT: tokens.USDT,
		};
		tokensV3[tokens.USDC.address] = 'USDC';
		tokensV3[tokens.USDT.address] = 'USDT';
	});
	it('Prepare accounts', async () => {
		signers = await getSigners();
		owner1 = signers[0];
		owner2 = signers[1];
		service = signers[2];
		users = signers.slice(3)[0];
		await mintTokens([service, owner1, owner2, ...users], tokensV3);
	});
	it('Set acceptable tokens', async () => {
		await setAcceptableTokens(payer, tokensV3);
	});
	it('Replace user addresses', async () => {
		expiration = await replaceUserAddresses(expiration, users);
	});
	it('Set additional amount to contract', async () => {
		for (const token of Object.keys(tokens)) {
			if (typeof tokens[token] === 'object') {
				const symbol = await tokens[token].symbol()
				const additionalAmount = getAdditionalAmount(expiration, symbol);
				await setAdditionalAmountToContract(
					payer,
					additionalAmount,
					owner1,
					tokens[token]
				);
				const balance = await payer
					.getTokenBalance(tokens[token].address);
				expect(cToken(balance, symbol)).to.equal(additionalAmount);
			}
		}
	});
	it('Post orders', async () => {
		const now = await getCurrentBlockTimestamp()
		expiration = await postOrders(payer, expiration, now + 7, tokensV3);

		for (const order of expiration.orders) {
			const contractOrder = await payer.orders(order.contract_id);
			expect(contractOrder.user).to.equal(order.user);
			expect(contractOrder.token).to.equal(
				tokensV3[order.token].address
			);
			expect(contractOrder.amount).to.equal(
				sToken(order.amount, order.token)
			);
			expect(contractOrder.additionalAmount).to.equal(sToken(0));
			expect(contractOrder.completed).to.be.false;
			expect(contractOrder.claimed).to.be.false;
		}
	});
	it('Execute orders', async () => {
		const expirationDuration = 5;
		const args = await getArgsForExecuteOrders(expiration);
		expect(args[0].length).to.equal(expiration.orders.length);
		expect(args[1].length).to.equal(expiration.orders.length);
		expect(args[2].length).to.equal(expiration.orders.length);
		await wait(expirationDuration);
		await executeOrders(payer, args);
		for (const order of expiration.orders) {
			const contractOrder = await payer.orders(order.contract_id);
			expect(contractOrder.user).to.equal(order.user);
			expect(contractOrder.token).to.equal(
				tokensV3[order.token].address
			);
			expect(contractOrder.amount).to.equal(
				sToken(order.amount, order.token)
			);
			const additionalAmount = order.order_executed ? order.additionalAmount : 0
			expect(contractOrder.additionalAmount).to.equal(
				sToken(additionalAmount, 'USD')
			);
			expect(contractOrder.completed).to.be.true;
			expect(contractOrder.claimed).to.equal(
				!order.order_executed
			);
		}
	});
	it('Claim orders', async () => {
		await claimOrders(payer, expiration, tokensV3);
		for (const order of expiration.orders) {
			const contractOrder = await payer.orders(order.contract_id);
			expect(contractOrder.user).to.equal(order.user);
			expect(contractOrder.token).to.equal(
				tokensV3[order.token].address
			);
			expect(contractOrder.amount).to.equal(
				sToken(order.amount, order.token)
			);
			const additionalAmount = order.order_executed ? order.additionalAmount : 0
			expect(contractOrder.additionalAmount).to.equal(
				sToken(additionalAmount, 'USD')
			);
			expect(contractOrder.completed).to.be.true;
			expect(contractOrder.claimed).to.be.true;
		}
	});
	it('Check contract balances', async () => {
		await checkContractBalances(payer, expiration, tokensV3);
	});
	it('Full withdrawal', async () => {
		await fullWithdrawal(payer, expiration, tokensV3);
	});
	it('Check empty balances', async () => {
		await checkEmptyBalances(payer, expiration, tokensV3);
	});
	it('Set owner1 address', async () => {
		const newOwner = users[1];
		const args = [newOwner.address];
		const user = users[0];
		expect(payer.connect(user).setOwner1Address(...args)).to.be.revertedWith(
			'NOT THE OWNERS'
		);
		await payer.setOwner1Address(...args);
		const contractOwner1 = await payer.owner1();
		expect(contractOwner1).to.equal(newOwner.address);
		await payer.connect(newOwner).setOwner1Address(owner1.address);
	});
	it('Set owner2 address', async () => {
		const args = [owner2.address];
		const user = users[0];
		expect(payer.connect(user).setOwner2Address(...args)).to.be.revertedWith(
			'NOT THE OWNERS'
		);
		await payer.setOwner2Address(...args);
		const contractOwner2 = await payer.owner2();
		expect(contractOwner2).to.equal(owner2.address);
	});
	it('Set payer address', async () => {
		const user = users[1];
		expect(payer.connect(user).setPayerAddress()).to.be.revertedWith(
			'NOT THE OWNERS'
		);
		tx = await payer.connect(owner2).setPayerAddress();
		tx = await tx.wait();
		const payerAddress = await payer.payerAddress();
		expect(payerAddress).to.equal(owner2.address);
		tx = await payer.connect(owner1).setPayerAddress();
		tx = await tx.wait();
	});
	it('Set service address', async () => {
		const args = [service.address];
		const user = users[0];
		expect(payer.connect(user).setServiceAddress(...args)).to.be.revertedWith(
			'NOT THE OWNERS'
		);
		await payer.setServiceAddress(...args);
		const serviceAddress = await payer.service();
		expect(serviceAddress).to.equal(service.address);
	});
	it('Get eth balance', async () => {
		await owner1.sendTransaction({ to: payer.address, value: sToken(1, 'ETH') });
		ethBalance = await payer.getEthBalance();
		expect(ethBalance).to.equal(sToken(1, 'ETH'));
	});
	it('Get back eth', async () => {
		const args = [owner1.address, ethBalance];
		const user = users[0];
		expect(payer.connect(user).getBackEth(...args)).to.be.revertedWith(
			'NOT ALLOWED ADDRESS'
		);
		await payer.getBackEth(...args)
		expect(payer.getBackEth(...args)).to.be.revertedWith(
			'FAILED TO SEND ETHER'
		);
		ethBalance = await payer.getEthBalance();
		expect(cToken(ethBalance, 'ETH')).to.equal(cToken(0, 'ETH'));
	});
	it('Edit acceptable token', async () => {
		const args = [tokensV3['USDT'].address, false, false, tokensV3['USDT'].minimalAmount];
		const user = users[0];
		expect(payer.connect(user).editAcceptableToken(...args)).to.be.revertedWith(
			'NOT THE OWNERS'
		);
		await payer.editAcceptableToken(...args);
		expect(payer.editAcceptableToken(tokensV3['USDT'].address, true, false, 0)).to.be.revertedWith(
			'NOT ALLOWED ZERO'
		);
		expect(await payer.acceptableTokensArray(0)).to.equal(
			tokensV3['USDC'].address
		);
		tx = await payer.editAcceptableToken(tokensV3['USDT'].address, true, false, tokensV3['USDT'].minimalAmount);
		await tx.wait();
		expect(await payer.acceptableTokensArray(1)).to.equal(
			tokensV3['USDT'].address
		);
		expect(payer.editAcceptableToken(tokensV3['USDC'].address, true, true, tokensV3['USDC'].minimalAmount)).to.be.revertedWith(
			'DUPLICATE TOKEN'
		);
	});
	it("If the order wasn't completed in time, revert to the original token and amount", async () => {
		let maxExecutionTime = await payer.maxExecutionTime();
		maxExecutionTime = Number(maxExecutionTime.toString())

		let orderDuration = 0;
		let expirationCopy
		let currentTimestamp = await getCurrentBlockTimestamp();
		while (!expirationCopy && orderDuration < 10) {
			await wait(1);
			try {
				expirationCopy = await postOrders(
					payer,
					{ ...expiration, orders: [expiration.orders[0]] },
					currentTimestamp + orderDuration,
					tokensV3
				);
			} catch (e) {
			}
			currentTimestamp = await getCurrentBlockTimestamp();
			orderDuration++
		}

		const order = expirationCopy.orders[0];
		let contractOrder = await payer.orders(order.contract_id);
		let cnt = 0
		while (currentTimestamp <= order.endTimestamp + maxExecutionTime && cnt < 10) {
			await wait(1);
			await mintTokens([service], tokensV3);
			currentTimestamp = await getCurrentBlockTimestamp();
			cnt++
		}

		if (
			!contractOrder.completed &&
			currentTimestamp > order.endTimestamp + maxExecutionTime
		) {
			await claimOrders(payer, expirationCopy, tokensV3);
			contractOrder = await payer.orders(order.contract_id);
			expect(contractOrder.tokenOut).to.equal(contractOrder.tokenIn);
			expect(contractOrder.amountOut).to.equal(contractOrder.amountIn);
		}
	});
	it("Forced claims are only available to the order's creator", async () => {
		let orderDuration = 0;
		let expirationCopy
		let currentTimestamp = await getCurrentBlockTimestamp();
		while (!expirationCopy && orderDuration < 10) {
			await wait(1);
			try {
				expirationCopy = await postOrders(
					payer,
					{ ...expiration, orders: [expiration.orders[0]] },
					currentTimestamp + orderDuration,
					tokensV3
				);
			} catch (e) {
			}
			currentTimestamp = await getCurrentBlockTimestamp();
			orderDuration++
		}

		const order = expirationCopy.orders[0];
		const expirationDuration = 5;
		const args = await getArgsForExecuteOrders(expirationCopy);
		await wait(expirationDuration);
		await executeOrders(payer, args);
		const id = order.contract_id;
		const user = order.signer;
		expect(
			payer.connect(user).claimOrder(id, true)
		).to.be.revertedWith('AVAILABLE ONLY OWNER');
		payer.claimOrder(id, true);
	});
	it('Execute orders exceptions trigger', async () => {
		const user = users[0];
		const orderDuration = await getCurrentBlockTimestamp();
		const orders = expiration.orders.filter((order) => order.order_executed);
		const expirationCopy = await postOrders(
			payer,
			{
				...expiration,
				orders,
			},
			orderDuration + 7,
			tokensV3
		);
		const expirationDuration = 5;
		const args = await getArgsForExecuteOrders(expirationCopy);

		expect(
			claimOrders(payer, expirationCopy, tokensV3)
		).to.be.revertedWith('ORDER NOT COMPLETED');

		expect(
			payer
				.connect(user)
				.executeOrders(args)
		).to.be.revertedWith('NOT THE ALLOWED ADDRESS');

		expect(
			payer.executeOrders(args)
		).to.be.revertedWith('WRONG EXPIRATION TIME');

		await wait(expirationDuration);
		const fakeArgs = JSON.parse(JSON.stringify(args));
		fakeArgs[1].push(false);
		expect(
			payer.executeOrders(
				fakeArgs,
			)
		).to.be.revertedWith('DIFFERENT LENGTH');

		await executeOrders(payer, args, service);
		expect(
			payer.executeOrders(args)
		).to.be.revertedWith('ORDER ALREADY COMPLETED');

		expect(
			claimOrders(payer, expirationCopy, tokensV3)
		).to.be.revertedWith('INSUFFICIENT PAYER BALANCE');

		await mintTokens([payer], tokensV3);
		for (const token of Object.keys(tokensV3)) {
			if (typeof tokensV3[token] === 'object') {
				const symbol = await tokensV3[token].symbol()
				tx = await tokensV3[token].connect(payer.signer).approve(payer.address, sToken(100000, symbol));
				tx = await tx.wait();
				await payer.deposit(tokensV3[token].address, sToken(100000, symbol))
			}
		}
		await claimOrders(payer, expirationCopy, tokensV3)

		expect(
			payer.executeOrders(args)
		).to.be.revertedWith('ORDER ALREADY CLAIMED');
	});
	it('Execute orders force claim', async () => {
		const orderDuration = await getCurrentBlockTimestamp();
		const expirationCopy = await postOrders(
			payer,
			{ ...expiration, orders: [expiration.orders[0]] },
			orderDuration + 7,
			tokensV3
		);
		const expirationDuration = 5;
		const args = await getArgsForExecuteOrders(expirationCopy);
		await wait(expirationDuration);
		await executeOrders(payer, args, owner1);
	});
	it('Deposit token exceptions trigger', async () => {
		const user = users[0];
		let token = tokensV3['USDC'].address;
		let amount = sToken(0, 'USDC');
		expect(payer.connect(user).deposit(token, amount)).to.be.revertedWith(
			'NOT ALLOWED ZERO'
		);
		token = users[1].address;
		amount = sToken(1, 'USDC');
		expect(payer.connect(user).deposit(token, amount)).to.be.revertedWith(
			'NOT ALLOWED TOKEN'
		);
	});
	it('Make order exceptions trigger', async () => {
		const user = users[0];
		const token = tokensV3['USDC'].address;
		const amount = sToken(500, 'USDC');
		let orderDuration = await getCurrentBlockTimestamp();
		const wrongAmount = sToken(0.1, 'USDC');
		const balanceUsdc = await payer.balanceOf(token, user.address);
		expect(
			payer.connect(user).fullWithdrawal(token, sToken(500000000000, 'USDC'))
		).to.be.revertedWith('NO TOKEN BALANCE');
		orderDuration = await getCurrentBlockTimestamp();
		tx = await payer.connect(user).fullWithdrawal(token, balanceUsdc);
		tx = await tx.wait();

		expect(
			payer
				.connect(user)
				.makeOrder(token, amount, orderDuration + 7)
		).to.be.revertedWith('NO TOKEN BALANCE');
		orderDuration = await getCurrentBlockTimestamp();

		await mintTokens([user], tokensV3);
		expect(
			payer.connect(user).deposit(token, amount)
		).to.be.revertedWith('TRANSFER FROM ERROR');
		orderDuration = await getCurrentBlockTimestamp();
		tx = await tokensV3['USDC'].connect(user).approve(payer.address, amount);
		tx = await tx.wait();
		tx = await payer.connect(user).deposit(token, amount);
		tx = await tx.wait();

		expect(
			payer
				.connect(user)
				.makeOrder(token, wrongAmount, orderDuration + 7)
		).to.be.revertedWith('WRONG AMOUNT');

		const maxDuration = await payer.maxDuration();

		expect(
			payer
				.connect(user)
				.makeOrder(token, amount, orderDuration + Number(maxDuration.toString()) + 1000)
		).to.be.revertedWith('DURATION MORE MAXIMUM');
	});
	it('Emergency quit', async () => {
		const tokens = [
			{ address: tokensV3['USDC'].address, symbol: 'USDC' },
			{ address: tokensV3['USDT'].address, symbol: 'USDT' },
		];
		const user = users[0];
		const orderDuration = await getCurrentBlockTimestamp();
		const expirationCopy = await postOrders(
			payer,
			{ ...expiration, orders: [expiration.orders[0]] },
			orderDuration + 7,
			tokensV3
		);
		const contract_id = expirationCopy.orders[0].contract_id;
		const order = await payer.orders(contract_id);
		const expirationDuration = 5;
		const args = await getArgsForExecuteOrders(expirationCopy);
		await wait(expirationDuration);
		await executeOrders(payer, args, owner2);
		const fullAccessAfter = await payer.fullAccessAfter();

		expect(
			payer.emergencyQuit(order.user, tokens[0].address, sToken(1, 'USDC'))
		).to.be.revertedWith('');

		const balance = await payer.balanceOf(tokens[0].address, order.user);
		if (cToken(balance, tokens[0].symbol) > 0) {
			expect(
				payer.emergencyQuit(order.user, tokens[0].address, balance)
			).to.be.revertedWith('WRONG TIMESTAMP');
		}

		await wait(fullAccessAfter);

		tx = await payer.claimOrder(contract_id, false);
		tx = await tx.wait();

		for (const token of tokens) {
			const balance = await payer.balanceOf(token.address, order.user);
			if (cToken(balance, token.symbol) > 0) {
				expect(
					payer.connect(user).emergencyQuit(order.user, token.address, balance)
				).to.be.revertedWith('AVAILABLE ONLY OWNER');
				tx = await payer.emergencyQuit(order.user, token.address, balance);
				tx = await tx.wait();
			}
		}
	});
});
