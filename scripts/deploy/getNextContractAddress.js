const { web3 } = require("hardhat");

async function main() {
  const accounts = await web3.eth.getAccounts();
  const deployer = accounts[0];
  
//   const nonce = await web3.eth.getTransactionCount(deployer);
  const nonce = 0;
  
  // Вычисляем адрес контракта используя web3
  const futureAddress = web3.utils.toChecksumAddress(
    '0x' + web3.utils.sha3(
      web3.utils.encodePacked(
        {t: 'address', v: deployer},
        {t: 'uint', v: nonce}
      )
    ).slice(-40)
  );

  console.log("Адрес следующего деплоя контракта:", futureAddress);
  console.log("Адрес деплоера:", deployer);
  console.log("Текущий nonce:", nonce);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });