
import dotenv from 'dotenv'
dotenv.config();
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import { getFollowerCount } from "./getTwitterFollowers";
import Web3 from 'web3';
import { ethers } from "ethers";
import { toString } from "lodash";
import fs from 'fs';

// Global Vars
const FOLLOWER_THRESHOLD = 100000;
const FT_CONTRACT_ABI = [{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"trader","type":"address"},{"indexed":false,"internalType":"address","name":"subject","type":"address"},{"indexed":false,"internalType":"bool","name":"isBuy","type":"bool"},{"indexed":false,"internalType":"uint256","name":"shareAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"ethAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"protocolEthAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"subjectEthAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"supply","type":"uint256"}],"name":"Trade","type":"event"},{"inputs":[{"internalType":"address","name":"sharesSubject","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"buyShares","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"sharesSubject","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"getBuyPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"sharesSubject","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"getBuyPriceAfterFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"supply","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"getPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"address","name":"sharesSubject","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"getSellPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"sharesSubject","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"getSellPriceAfterFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"protocolFeeDestination","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"protocolFeePercent","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"sharesSubject","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"sellShares","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"_feeDestination","type":"address"}],"name":"setFeeDestination","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_feePercent","type":"uint256"}],"name":"setProtocolFeePercent","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_feePercent","type":"uint256"}],"name":"setSubjectFeePercent","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"sharesBalance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"sharesSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"subjectFeePercent","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}];
const SUPPLY_THRESHOLD = 10;
const FT_CONTRACT_ADDRESS = '0xCF205808Ed36593aa40a44F10c7f7C2F67d4A4d4';
const EXECUTOR_ADDRESS = '0x4D618E5aC529Dac6940835E7CE3320012d1D0529';
const privKey = process.env.PRIVATE_KEY as string;

// Web3 Setup
const web3 = new Web3('https://base-mainnet.public.blastapi.io');
const smartContract = new web3.eth.Contract(FT_CONTRACT_ABI as any, FT_CONTRACT_ADDRESS);
const myAccount = web3.eth.accounts.privateKeyToAccount(privKey);
web3.eth.accounts.wallet.add(myAccount);
web3.eth.defaultAccount = EXECUTOR_ADDRESS;



const formatWeiToEth = (wei: ethers.BigNumber): string => {
  return ethers.utils.formatEther(wei);
};


class ProfileManager {
  db: PrismaClient;
  redis: Redis;
  readonly REDIS_LIST_KEY = 'checked_twitter_usernames';

  constructor() {
    this.db = new PrismaClient();
    this.redis = new Redis();
  }

  async detectAndCheckNewUsers() {
    const latestUsers = await this.db.user.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: 20000
    });
    
    const usersWithTwitter = latestUsers.filter(user => user.twitterUsername !== null);
    console.log("Fetched latest users w/ Twitter:");
    return usersWithTwitter;
  }

  async hasUserBeenChecked(twitterName: string): Promise<boolean> {
    const exists = await this.redis.sismember(this.REDIS_LIST_KEY, twitterName);
    return exists === 1;
  }

  async getBuyPriceInWei(address: string, amount: number): Promise<ethers.BigNumber> {
    const price = await smartContract.methods.getBuyPrice(address, amount).call();
    const weiAmount = ethers.BigNumber.from(price);
    return weiAmount;
  }

  async getBuyPrice(address: string, amount: number): Promise<any> {
    const price = await smartContract.methods.getBuyPrice(address, amount).call();
    const priceStr = price.toString();
      const weiAmount = ethers.BigNumber.from(priceStr);
      if (!weiAmount) {
        console.error("Failed to convert to BigNumber.");
        return;
      }
  
      const formatPrice = formatWeiToEth(weiAmount);
      console.log(formatPrice);
      return formatPrice
  }

  async markUserAsChecked(twitterName: string) {
    await this.redis.sadd(this.REDIS_LIST_KEY, twitterName);
  }

  async shouldBuyStock(user: any): Promise<boolean> {
    if (user.supply > SUPPLY_THRESHOLD) {
      return false; // If supply is more than threshold, we don't buy.
    }

    const followerCount = await getFollowerCount(user.twitterUsername);
    if (followerCount && followerCount >= FOLLOWER_THRESHOLD) {
      return true; // If follower count is above threshold and supply is below threshold, we buy.
    }
    return false;
  }

  async submitBuyOrder(username: string, address: string, payableAmount: ethers.BigNumberish) {
    try {
      const tx = smartContract.methods.buyShares(payableAmount, address, 1);
  
      tx.send({ from: EXECUTOR_ADDRESS, value: payableAmount })
        .on('transactionHash', (hash: string) => {
          console.log(`Submitted buy order for ${username}, txHash: ${hash}`);
        })
        .on('receipt', (receipt: any) => {
          console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
  
          // Log relevant data to a file
          const logData = {
            username,
            address,
            payableAmount,
            txHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
            // Add any other relevant data here
          };
  
          fs.appendFileSync('transaction_logs.txt', JSON.stringify(logData) + '\n');
        })
        .on('error', (error: Error) => {
          console.error(`Failed to submit buy order for ${username}: ${error}`);
        });
  
    } catch (error) {
      console.error(`Failed to submit buy order for ${username}: ${error}`);
    }
  }

  async checkUsers() {
    console.log("Start of CheckUsers");
    const newUserList = await this.detectAndCheckNewUsers();
    for (const user of newUserList) {
        if (user.twitterUsername)
        try {
            if (await this.shouldBuyStock(user)) {
                const price = await this.getBuyPriceInWei(user.address, 1)
                console.log(`Buying stock for ${user.twitterUsername}`);
                this.submitBuyOrder(user.twitterUsername, user.address, price);
            }
        } catch (error: any) {
            console.error(`Error while checking user ${user.twitterUsername}. Error: ${error.message}`);
        }
    }
}
}


const profileManager = new ProfileManager();
