async function main() {
  let accounts = await ethers.getSigners()
  const owner = accounts[0]
  const ownerAddress = accounts[0].address
  const ReferralV3 = await hre.ethers.getContractFactory('ReferralV3')
  let referralV3 = await ReferralV3.deploy()
  referralV3 = await referralV3.deployed()
  const referralV3Address = referralV3.address
  console.log(`${referralV3Address}: referralV3Address`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
