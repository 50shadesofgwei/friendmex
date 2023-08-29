import axios from 'axios';
import Redis from "ioredis";

const bearerToken = process.env.BEARER_TOKEN;
const redis = new Redis();
const PROCESSED_USERS_SET = 'processed_users';


export async function getFollowerCount(username: string): Promise<number | null> {

    const headers = {
        "User-Agent": "v2UserLookupJS",
        "authorization": `Bearer ${bearerToken}`
    };

    const url = `https://api.twitter.com/2/users/by/username/${username}?user.fields=public_metrics`;
    ;

    try {
        const response = await axios.get(url, {
            headers: headers
        });

        if (response.status !== 200) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            return null;
        }
        console.log(response.data.data.public_metrics.userId);
        return response.data.data.public_metrics.userId;
    } catch (error: any) {
        if (error.response) {
            // The request was made and the server responded with a status code outside of the 2xx range
            console.error(`Error: ${error.response.status} ${error.response.statusText}`);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received from the server.');
        } else {
            // Some other error occurred
            console.error(`Request failed: ${error.message}`);
        }
        return null;
    }
}
