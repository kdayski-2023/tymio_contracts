const hre = require('hardhat');
const { expect } = require('chai');
const { cToken, convertFloatToBnString, sToken, thowDotPart, roudToDecimals } = require('../test/utils');

const tokensV1 = {
	'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 'USDC',
	'0x0000000000000000000000000000000000000000': 'ETH',
	'0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8': 'USDC',
	'0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': 'WBTC',
	'0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f': 'WBTC',
	undefined: 'ETH',
};

const DECIMALS = {
	USDT: 6,
	USDC: 6,
	USD: 6,
	WBTC: 8,
	WETH: 18,
	ETH: 18,
};

function getAdditionalAmount(expiration, token = 'USDC') {
	let additionalAmountSum = 0;
	for (const order of expiration.orders) {
		if (order.token === token) {
			additionalAmountSum += Number(order.additionalAmount);
		}
	}
	additionalAmountSum = cToken(
		convertFloatToBnString(
			Math.round(additionalAmountSum * 10 ** DECIMALS[token]) /
			10 ** DECIMALS[token],
			DECIMALS[token]
		),
		token
	);
	return additionalAmountSum;
}

async function replaceUserAddresses(expiration, users) {
	const usersObj = {};
	let cnt = 0;
	for (const [_, order] of expiration.orders.entries()) {
		if (usersObj[order.user]) continue;
		else {
			usersObj[order.user] = users[cnt];
			cnt++;
		}
	}
	for (const [_, order] of expiration.orders.entries()) {
		order.signer = usersObj[order.user];
		order.user = usersObj[order.user].address;
	}
	return expiration;
}

async function postOrders(payer, expiration, _executionTimestamp, tokensV3) {
	for (const order of expiration.orders) {
		const token = tokensV3[order.token];
		const _amount = sToken(order.amount, order.token);
		const _tokenAddress = tokensV3[order.token].address

		tx = await token.connect(order.signer).approve(payer.address, _amount);
		tx = await tx.wait();
		tx = await payer
			.connect(order.signer)
			.depositAndOrder(
				_tokenAddress,
				_amount,
				_amount,
				_executionTimestamp
			);
		tx = await tx.wait();

		for (const event of tx.events) {
			if (event.event === 'NewOrder') {
				order.contract_id = event.args.orderId.toString();
				order.endTimestamp = _executionTimestamp;
			}
		}
	}

	const id = expiration.orders[expiration.orders.length - 1].contract_id;
	const user = expiration.orders[expiration.orders.length - 1].signer;
	const claimTokenAddress = tokensV3[expiration.orders[expiration.orders.length - 1].token].address;
	const args = [id, claimTokenAddress, false];
	expect(payer.connect(user).claimOrder(...args)).to.be.revertedWith(
		'ORDER NOT COMPLETED'
	);
	return expiration;
}

async function getArgsForExecuteOrders(expiration) {
	let args = [[], [], []];
	for (const order of expiration.orders) {
		args[0].push(order.contract_id);
		args[1].push(order.order_executed);
		args[2].push(sToken(order.additionalAmount, 'USD'));
	}
	return args;
}

async function executeOrders(
	payer,
	args,
	from = ''
) {
	if (from) {
		tx = await payer
			.connect(from)
			.executeOrders(
				args
			);
		tx = await tx.wait();
	} else {
		tx = await payer.executeOrders(
			args
		);
		tx = await tx.wait();
	}
}

async function claimOrders(payer, expiration, tokensV3) {
	const id = 0;
	const user = expiration.orders[0].signer;
	let claimTokenAddress = tokensV3['WBTC'].address;
	const args = [id, claimTokenAddress, false];
	expect(
		payer.connect(user).claimOrder(id, claimTokenAddress, false)
	).to.be.revertedWith('IS NOT USD TOKEN');
	for (const order of expiration.orders) {
		const id = order.contract_id;
		const user = order.signer;
		const claimTokenAddress = tokensV3['USDC'].address;
		expect(user.address).to.equal(order.user);
		tx = await payer.connect(user).claimOrder(id, claimTokenAddress, false);
		tx = await tx.wait();
	}
	expect(payer.connect(user).claimOrder(...args)).to.be.revertedWith(
		'ORDER ALREADY CLAIMED'
	);
}

async function fullWithdrawal(payer, expiration, tokensV3) {
	const usdcAddress = tokensV3['USDC'].address;
	const wethAddress = tokensV3['WETH'].address;
	const wbtcAddress = tokensV3['WBTC'].address;
	for (const order of expiration.orders) {
		const signer = order.signer;
		const address = order.user;
		const balanceWeth = await payer.balanceOf(wethAddress, address);
		const balanceWbtc = await payer.balanceOf(wbtcAddress, address);
		const balanceUsdc = await payer.balanceOf(usdcAddress, address);
		if (cToken(balanceWeth, 'WETH') > 0) {
			tx = await payer.connect(signer).fullWithdrawalETH(balanceWeth);
			tx = await tx.wait();
		}
		if (cToken(balanceWbtc, 'WBTC') > 0) {
			tx = await payer.connect(signer).fullWithdrawal(wbtcAddress, balanceWbtc);
			tx = await tx.wait();
		}
		if (cToken(balanceUsdc, 'USDC') > 0) {
			tx = await payer.connect(signer).fullWithdrawal(usdcAddress, balanceUsdc);
			tx = await tx.wait();
		}
	}

	const user = expiration.orders[0].signer;
	let args = [sToken(1, 'ETH')];
	expect(payer.connect(user).fullWithdrawalETH(...args)).to.be.revertedWith(
		'NOT ENOUGH WETH TOKENS ON THE BALANCE'
	);
	args = [usdcAddress, sToken(1, 'USDC')];
	expect(payer.connect(user).fullWithdrawal(...args)).to.be.revertedWith(
		'NOT ENOUGH TOKENS ON THE BALANCE'
	);
}

async function getSigners() {
	const accounts = await hre.ethers.getSigners();
	const service = accounts[0];
	const owner = accounts[1];
	const owner2 = accounts[2];
	const users = [];
	for (let i = 3; i < accounts.length; i++) {
		users.push(accounts[i]);
	}
	return [service, owner, owner2, users];
}

async function deployTokens(tokens = ['USDC', 'USDT', 'WBTC', 'WETH']) {
	const result = {}
	for (const token of tokens) {
		if (token === 'WETH') {
			const WETH = await hre.ethers.getContractFactory('WETH9');
			let weth = await WETH.deploy();
			weth = await weth.deployed();
			result[token] = weth
		} else {
			const Usd = await hre.ethers.getContractFactory('ERC20');
			let usd = await Usd.deploy(token, token, DECIMALS.USDC);
			usd = await usd.deployed();
			result[token] = usd
		}
	}
	return result;
}

async function setAdditionalAmountToContract(
	payer,
	additionalAmount,
	owner,
	token
) {
	const usdAddress = token.address;
	const symbol = await token.symbol()
	tx = await token
		.connect(owner)
		.approve(payer.address, sToken(additionalAmount, symbol));
	tx = await tx.wait();
	tx = await payer
		.connect(owner)
		.deposit(usdAddress, sToken(additionalAmount, symbol));
	tx = await tx.wait();
}

async function deploySwapRouter() {
	const TestSwapRouter = await hre.ethers.getContractFactory('TestSwapRouter');
	let testSwapRouter = await TestSwapRouter.deploy();
	testSwapRouter = await testSwapRouter.deployed();
	return testSwapRouter;
}

async function deployPayer(contract = 'PayerV3') {
	const Payer = await hre.ethers.getContractFactory(contract);
	let payer = await Payer.deploy();
	payer = await payer.deployed();
	return payer;
}

async function compareBalanceUsdc(
	payer,
	balanceUsdcNeed,
	usdcAddress,
	usdcSymbol,
	address
) {
	const balanceUsdc = cToken(
		await payer.balanceOf(usdcAddress, address),
		usdcSymbol
	);
	balanceUsdcNeed = cToken(
		convertFloatToBnString(balanceUsdcNeed, DECIMALS.USDC),
		'USDC'
	);
	expect(parseFloat(balanceUsdc)).to.be.above(0);
	expect(parseFloat(balanceUsdc) - parseFloat(balanceUsdcNeed)).to.be.below(
		0.001
	);
}

async function checkEmptyBalances(payer, expiration, tokensV3) {
	for (const order of expiration.orders) {
		const user = order.user;
		const balanceUsdc = cToken(
			await payer.balanceOf(tokensV3['USDC'].address, user),
			['USDC']
		);
		const balanceWeth = cToken(
			await payer.balanceOf(tokensV3['WETH'].address, user),
			['WETH']
		);
		const balanceWbtc = cToken(
			await payer.balanceOf(tokensV3['WBTC'].address, user),
			['WBTC']
		);
		expect(parseFloat(balanceUsdc)).to.equal(0);
		expect(parseFloat(balanceWeth)).to.equal(0);
		expect(parseFloat(balanceWbtc)).to.equal(0);
	}
}

async function checkContractBalances(payer, expiration, tokensV3) {
	const balanceNeed = {};
	for (const order of expiration.orders) {
		const tokenOutSymbol = tokensV1[order.tokenOut];
		const usdcSymbol = 'USDC';
		const address = order.user;
		if (tokenOutSymbol === usdcSymbol) {
			const additionalAmount = parseFloat(order.additionalAmount);
			const amountOut = parseFloat(order.amountOut);
			const balanceUsdcNeed = amountOut + additionalAmount;
			if (balanceNeed[address]) {
				if (balanceNeed[address]['USDC'])
					balanceNeed[address]['USDC'] =
						balanceNeed[address]['USDC'] + balanceUsdcNeed;
				else balanceNeed[address]['USDC'] = balanceUsdcNeed;
			} else balanceNeed[address] = { USDC: balanceUsdcNeed };
		} else {
			const additionalAmount = parseFloat(order.additionalAmount);
			const balanceUsdcNeed = additionalAmount;
			if (balanceNeed[address]) {
				if (balanceNeed[address]['USDC'])
					balanceNeed[address]['USDC'] =
						balanceNeed[address]['USDC'] + balanceUsdcNeed;
				else balanceNeed[address]['USDC'] = balanceUsdcNeed;
			} else balanceNeed[address] = { USDC: balanceUsdcNeed };

			if (balanceNeed[address][tokenOutSymbol])
				balanceNeed[address][tokenOutSymbol] =
					balanceNeed[address][tokenOutSymbol] + order.amountOut;
			else balanceNeed[address][tokenOutSymbol] = order.amountOut;
		}
	}

	for (const [address, tokens] of Object.entries(balanceNeed)) {
		for (const [tokenSymbol, value] of Object.entries(tokens)) {
			const tokenAddress = tokensV3[tokenSymbol].address;

			if (tokenSymbol === 'USDC')
				await compareBalanceUsdc(
					payer,
					value,
					tokenAddress,
					tokenSymbol,
					address
				);
			else {
				const balance = cToken(
					await payer.balanceOf(tokenAddress, address),
					tokenSymbol
				);
				const valueNeed = cToken(
					convertFloatToBnString(value, DECIMALS[tokenSymbol]),
					tokenSymbol
				);
				expect(parseFloat(balance)).to.be.above(0);
				expect(parseFloat(balance) - parseFloat(valueNeed)).to.be.below(
					0.0000001
				);
			}
		}
	}
}

async function mintTokens(accounts, tokensV3) {
	for (const account of accounts) {
		for (const token of Object.keys(tokensV3)) {
			if (token !== 'WETH' && typeof (tokensV3[token]) === 'object') {
				tx = await tokensV3[token].mint(account.address, sToken(1000000, token));
				await tx.wait();
			}
		}
	}
}

async function sendEthForTransfer(owner, wethAddress) {
	await owner.sendTransaction({ to: wethAddress, value: sToken(5000, 'ETH') });
}

async function setAcceptableTokens(payer, tokens) {
	let idx = 0
	for (const token of Object.keys(tokens)) {
		if (typeof (tokens[token]) === 'object') {
			tx = await payer.editAcceptableToken(tokens[token].address, true, true, 1);
			await tx.wait();
			expect(await payer.acceptableTokensArray(idx)).to.equal(tokens[token].address);
			idx++
		}
	}
}
async function setRatio(swapRouter, tokens, prices) {
	const usdWbtcPrice = thowDotPart(sToken(1, 'WBTC') / prices['WBTC']);
	const wbtcUsdPrice = sToken(prices['WBTC'], 'USD');
	const ethUsdPrice = sToken(prices['WETH'], 'USD');
	const usdEthPrice = thowDotPart(sToken(1, 'WETH') / prices['WETH']);
	tx = await swapRouter.setRatio(
		tokens['USDC'].address,
		tokens['WETH'].address,
		usdEthPrice
	);
	await tx.wait();
	tx = await swapRouter.setRatio(
		tokens['WETH'].address,
		tokens['USDC'].address,
		ethUsdPrice
	);
	await tx.wait();
	if (prices['WBTC']) {
		tx = await swapRouter.setRatio(
			tokens['WBTC'].address,
			tokens['USDC'].address,
			wbtcUsdPrice
		);
		await tx.wait();
		tx = await swapRouter.setRatio(
			tokens['USDC'].address,
			tokens['WBTC'].address,
			usdWbtcPrice
		);
		await tx.wait();
	}
}

async function getAcceptableTokens(payer) {
	const acceptableTokensArray = [];
	let cnt = 0;
	while (true) {
		try {
			const token = await payer.acceptableTokensArray(cnt);
			acceptableTokensArray.push(token);
			cnt++;
		} catch (e) {
			break;
		}
	}
	return acceptableTokensArray;
}

async function getOrder(payer, id) {
	const token = await payer.orders(id);
	return token;
}

async function getSwapsOutMinimal(payer, args, prices, tokensV3) {
	const swapsIn = {};
	const swapsOut = {};
	const swapsOutMinimal = {};
	const acceptableTokensArray = await getAcceptableTokens(payer);
	const params = {
		orderIds: args[0],
		swap: args[1],
		additionalAmount: args[2],
		swapMinimal: [],
	};

	if (
		params.orderIds.length !== params.swap.length ||
		params.swap.length !== params.additionalAmount.length
	)
		throw new Error('DIFFERENT LENGTH');

	for (let i = 0; i < acceptableTokensArray.length; i++) {
		for (let j = 0; j < acceptableTokensArray.length; j++) {
			if (acceptableTokensArray[i] === acceptableTokensArray[j]) continue;
			if (!swapsIn[acceptableTokensArray[i]])
				swapsIn[acceptableTokensArray[i]] = {};
			if (!swapsOut[acceptableTokensArray[i]])
				swapsOut[acceptableTokensArray[i]] = {};
			if (!swapsOutMinimal[acceptableTokensArray[i]])
				swapsOutMinimal[acceptableTokensArray[i]] = {};
			swapsOutMinimal[acceptableTokensArray[i]][acceptableTokensArray[j]] = 0;
			swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]] = 0;
			swapsOut[acceptableTokensArray[i]][acceptableTokensArray[j]] = 0;
		}
	}

	for (let i = 0; i < params.orderIds.length; i++) {
		if (params.swap[i]) {
			const order = await getOrder(payer, params.orderIds[i]);
			swapsIn[order.tokenIn][order.tokenOut] =
				swapsIn[order.tokenIn][order.tokenOut] +
				parseFloat(cToken(order.amountIn, tokensV3[order.tokenIn]));
			const isUsd = await payer.isUsdToken(order.tokenIn);
			if (isUsd) {
				swapsOut[order.tokenIn][order.tokenOut] =
					swapsOut[order.tokenIn][order.tokenOut] +
					parseFloat(cToken(order.amountIn, tokensV3[order.tokenIn])) /
					prices[tokensV3[order.tokenOut]];
			} else {
				swapsOut[order.tokenIn][order.tokenOut] =
					swapsOut[order.tokenIn][order.tokenOut] +
					parseFloat(cToken(order.amountIn, tokensV3[order.tokenIn])) *
					prices[tokensV3[order.tokenIn]];
			}
		}
	}

	for (let i = 0; i < acceptableTokensArray.length; i++) {
		for (let j = 0; j < acceptableTokensArray.length; j++) {
			if (swapsOut[acceptableTokensArray[i]][acceptableTokensArray[j]] > 0) {
				const tokenIn = acceptableTokensArray[i];
				const tokenOut = acceptableTokensArray[j];
				const amount = swapsOut[tokenIn][tokenOut];
				swapsOutMinimal[tokenIn][tokenOut] = roudToDecimals(
					amount - (amount / 100) * 5,
					DECIMALS[tokensV3[tokenOut]]
				);
			}
		}
	}
	let swapsCount = 0;
	const result = [];
	for (let i = 0; i < acceptableTokensArray.length; i++) {
		for (let j = 0; j < acceptableTokensArray.length; j++) {
			if (swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]] > 0) {
				const tokenIn = acceptableTokensArray[i];
				const tokenOut = acceptableTokensArray[j];
				const amountIn =
					swapsIn[acceptableTokensArray[i]][acceptableTokensArray[j]];
				const amountOutDesired =
					swapsOut[acceptableTokensArray[i]][acceptableTokensArray[j]];
				const amountOutMinimum =
					swapsOutMinimal[acceptableTokensArray[i]][acceptableTokensArray[j]];

				expect(amountOutMinimum).to.equal(
					roudToDecimals(
						amountOutDesired - (amountOutDesired / 100) * 5,
						DECIMALS[tokensV3[tokenOut]]
					)
				);
				result.push(sToken(amountOutMinimum, tokensV3[tokenOut]));
				swapsCount++;
			}
		}
	}
	return result;
}

async function getCurrentBlockTimestamp() {
	const blockNumber = await hre.ethers.provider.getBlockNumber();
	const block = await hre.ethers.provider.getBlock(blockNumber);
	return block.timestamp;
}

module.exports = {
	setRatio,
	setAcceptableTokens,
	getAcceptableTokens,
	getSwapsOutMinimal,
	getAdditionalAmount,
	postOrders,
	replaceUserAddresses,
	executeOrders,
	claimOrders,
	fullWithdrawal,
	getArgsForExecuteOrders,
	deployTokens,
	deploySwapRouter,
	deployPayer,
	mintTokens,
	getSigners,
	setAdditionalAmountToContract,
	checkContractBalances,
	sendEthForTransfer,
	checkEmptyBalances,
	DECIMALS,
	tokensV1,
	getCurrentBlockTimestamp
};