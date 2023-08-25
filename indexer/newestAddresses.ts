
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import { getFollowerCount, FT_CONTRACT_ABI } from "./getTwitterFollowers";
import Web3 from 'web3';
import { AbiItem } from 'web3-utils'


const FOLLOWER_THRESHOLD = 50000;
const ABI_ATTEMPT2 = FT_CONTRACT_ABI as unknown as AbiItem[];
const SUPPLY_THRESHOLD = 10;
const FT_CONTRACT_ADDRESS = '0xCF205808Ed36593aa40a44F10c7f7C2F67d4A4d4';
const EXECUTOR_ADDRESS = '0x4D618E5aC529Dac6940835E7CE3320012d1D0529';
const web3 = new Web3('https://base-mainnet.public.blastapi.io');
const smartContract = new web3.eth.Contract(ABI_ATTEMPT2 as any, '0x4D618E5aC529Dac6940835E7CE3320012d1D0529');


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

  async getBuyPriceAfterFee(address: string, amount: number): Promise<any> {
    const priceAfterFee = await smartContract.methods.getBuyPrice(address, amount).call();
    console.log(priceAfterFee);
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

  async submitBuyOrder(username: string, address: string) {
    smartContract.methods.buyShares(address, 1)
    console.log(`Submitted buy order for ${username}`);
  }

  async checkUsers() {
    console.log("Start of CheckUsers");
    const newUserList = await this.detectAndCheckNewUsers();
    for (const user of newUserList) {
        if (user.twitterUsername)
        try {
            if (await this.shouldBuyStock(user)) {
                console.log(`Buying stock for ${user.twitterUsername}`);
                this.submitBuyOrder(user.twitterUsername, user.address);
            }
        } catch (error: any) {
            console.error(`Error while checking user ${user.twitterUsername}. Error: ${error.message}`);
        }
    }
}
}


// Usage
const profileManager = new ProfileManager();
// web3.eth
//     .getBlockNumber()
//     .then(result => {
//         console.log('Current block number: ' + result);
//     })
//     .catch(error => {
//         console.error(error);
//     });


async function getPrice() {
  const example = await profileManager.getBuyPriceAfterFee('0xba2426fa663455806d4b34ea71876df2e20e561a', 1);
  console.log(example)
}

getPrice();
// setInterval(() => {
//   profileManager.checkUsers();
// }, 10000);  // 10000 milliseconds = 10 seconds
