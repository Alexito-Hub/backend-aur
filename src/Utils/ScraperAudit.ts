import AppleMusic from '../Core/Scraper/applemusic';
import Bilibili from '../Core/Scraper/bilibili';
import Claude from '../Core/Scraper/claude';
import Colorize from '../Core/Scraper/colorize';
import DeepAI from '../Core/Scraper/deepai';
import Facebook from '../Core/Scraper/facebook';
import InstagramV2 from '../Core/Scraper/ig2';
import Instagram from '../Core/Scraper/instagram';
import JNE from '../Core/Scraper/JNE';
import KimiAI from '../Core/Scraper/kimiai';
import LlamaCoder from '../Core/Scraper/llamacode';
import NanoBanana from '../Core/Scraper/nanobanana';
import OpenFoodFacts from '../Core/Scraper/openfoodfacts';
import Photoroom from '../Core/Scraper/Photoroom';
import Pinterest from '../Core/Scraper/pinterest';
import Spotify from '../Core/Scraper/spotify';
import Threads from '../Core/Scraper/threads';
import TikTok from '../Core/Scraper/tiktok';
import Twitter from '../Core/Scraper/twitter';
import WinkClient from '../Core/Scraper/winkai';
import YouTube from '../Core/Scraper/youtube';
import BingCreate from '../Core/Scraper/bing';
import fs from 'fs';

async function auditScrapers() {
    console.log('--- Starting Full Scraper Audit ---');
    const results: any[] = [];

    const testCases = [
        { name: 'AppleMusic', instance: AppleMusic, method: 'search', input: 'Taylor Swift' },
        { name: 'Bilibili', instance: Bilibili, method: 'download', input: 'https://www.bilibili.tv/en/video/4798816072636416' },
        { name: 'Claude', instance: Claude, method: 'chat', input: 'Hello Claude' },
        { name: 'DeepAI', instance: DeepAI, method: 'chat', input: 'Hello DeepAI' },
        { name: 'Facebook', instance: Facebook, method: 'download', input: 'https://www.facebook.com/61586333484983/videos/2083380132235326/' },
        { name: 'InstagramV2', instance: InstagramV2, method: 'download', input: 'https://www.instagram.com/reel/DVUyoRLDZaW/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ==' },
        { name: 'Instagram', instance: Instagram, method: 'download', input: 'https://www.instagram.com/reel/DVUyoRLDZaW/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ==' },
        { name: 'KimiAI', instance: KimiAI, method: 'chat', input: 'Hello Kimi' },
        { name: 'OpenFoodFacts', instance: OpenFoodFacts, method: 'barcode', input: '7622210449283' },
        { name: 'Pinterest', instance: Pinterest, method: 'pindl', input: 'https://pin.it/1vrWsLzcr' },
        { name: 'Spotify', instance: Spotify, method: 'download', input: 'https://open.spotify.com/intl-es/track/6nGeLlakfzlBcFdZXteDq7?si=90c79b44c83549f8' },
        { name: 'Threads', instance: Threads, method: 'download', input: 'https://www.threads.com/@escritoperfecto/post/DWW4_vlkQhQ?xmt=AQF0oLDJ80TWxymhLqbuQW3eKF7wkSaYLDJRI0ADzb9Tjg' },
        { name: 'TikTok', instance: TikTok, method: 'download', input: 'https://www.tiktok.com/@comedy.usa258/video/7616194074550324510?is_from_webapp=1&sender_device=pc' },
        { name: 'Twitter', instance: Twitter, method: 'download', input: 'https://x.com/______punished/status/2037420201466380780?s=20' },
        { name: 'YouTube', instance: YouTube, method: 'getInfo', input: 'https://youtu.be/V1bFr2SWP1I?si=TuFdbt555adrJthI' },
        { name: 'BingCreate', instance: BingCreate, method: 'createImage', input: 'A futuristic city' }
    ];

    for (const tc of testCases) {
        console.log(`Testing [${tc.name}]...`);
        let output: any = null;
        let error: any = null;
        let status = 'success';

        try {
            // @ts-ignore
            output = await tc.instance[tc.method](tc.input);
        } catch (e: any) {
            status = 'failed';
            error = e.message;
        }

        results.push({
            scraper: tc.name,
            method: tc.method,
            request: {
                input: tc.input
            },
            response: {
                status,
                data: output,
                error
            },
            timestamp: new Date().toISOString()
        });
    }

    fs.writeFileSync('scraper_results.json', JSON.stringify(results, null, 2));
    console.log('--- Audit Finished. Results saved to scraper_results.json ---');
}

auditScrapers().catch(console.error);
