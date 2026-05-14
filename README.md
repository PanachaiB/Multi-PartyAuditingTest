# Multi-Party Auditing Framework

## Project Overview
This repository is meant to showcase and implement the system model as depicted in the research paper submitted as a term project, utilizing Node.js Hardhat to simulate the blockchain and scripts to run encryption, decryption, authentication, and auditing schemes as a proof of concept for our system model.

## Prerequisite
This project utilizes Node.js Hardhat tool in order to simulate a local blockchain that was used for the majority of the test cases. The current version used by this paper is v24.15.0 which can be found at the Node.js website using the prepared installer. During the installation phase, it is advised that you check the box to isntall necessary tools (this should include Chocolatey and other necessary tools that allow certain dependencies to work). Once done, a few more things need to be done in order to ensure complete functionality before the tests. Git is also recommended but not necessary.

## Setting up the environment.

Install the project by using the git clone in your terminal. Copy the URL from under the <>Code section.

```shell
git clone "this repository's url"
```

Alternatively, you can simply download the repository as a zip file under the drop down menu after pressing <>Code. This will not affect the project's ability to function, so use the method that you find most convenient. Once you have cloned/installed and unzipped the repository, point your terminal to the repository's folder on your computer.

```shell
cd "your folder's file path"
```

For Windows, you can simply drag the folder from file explorer onto the terminal to copy paste the file path for your folder. Once you've successfully pointed your terminal to the repository folder, execute the commands:

```shell
npm install
npx hardhat compile
```

'npm install' will download all needed dependencies, and 'npx hardhat compile' will ensure that the smart contract is properly compiled and adjusted for testing

### Running Tests

Now we can move to running tests. The proof of concept logic test is in the file runSimulation.ts and can be run using the following command:

```shell
Open 2 terminals, make sure both are pointing to the folder
Run npx hardhat node on one of them
the other starts with running npm run phase1 for setup of contract
1. Run npx hardhat run scripts/phase1.ts --network localhost
2. Run the phase2 python script
3. Run the phase3.ts script (don't forget --network localhost)
4. Run the phase4.ts script to show that no consensus = no retrieval
5. Run the audit commands: npx hardhat audit --party SIIT--signer 6 --epoch 4 --success true --network localhost
6. Run the phase4.ts script again to show files are accessible now
```

'encryptbenchmark.ts' shows the performance of our encryption method by testing with various data sizes.
'smtbenchmark.ts' is our proof that the On-Chain storage remains O(1) across all numbers of node due to the blockchain only storing the root node, along with the build time for the tree and proof generation
'tag-zkp-authenbenchmark.ts' runs a test for the tagging, zkp, and authentication time.
'auditbenchmark.ts' runs a test that simulates any additional overhead in auditing with the increase in auditing peers.
'retreivalbenchmark.ts' since our paper emphasizes on being able to verify data before retrieval, this test provides a test to see how much delay is added due to the process of verifying data before retrieval.
