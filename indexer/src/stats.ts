import Redis from "ioredis";
import logger from "./utils/logger";
import { getPrice } from "./utils/math";
import constants from "./utils/constants";
import { PrismaClient, type User } from "@prisma/client";

export default class Stats {
  // Database
  private db: PrismaClient;
  // Redis cache
  private redis: Redis;

  /**
   * Create new Stats
   * @param {string} redis_url Cache URL
   */
  constructor(redis_url: string) {
    // Setup db
    this.db = new PrismaClient();
    // Setup redis
    this.redis = new Redis(redis_url);
  }

  /**
   * Tracks newest 50 users
   */
  async updateNewestUsers(): Promise<void> {
    const users: User[] = await this.db.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    await this.redis.set("latest_users", JSON.stringify(users));
  }
}
