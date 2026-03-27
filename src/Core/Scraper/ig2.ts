/** import axios from 'axios';
//const axios = require("axios")

async function instagramDownload(instagramUrl) {
    const apiUrl = 'https://ssvid.net/api/ajax/search?hl=en';
    
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': '*/*',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36'
    };

    const data = new URLSearchParams();
    data.append('query', instagramUrl);

    try {
        const response = await axios.post(apiUrl, data, { headers });
        const jsonData = response.data;

        // Handle gallery (multiple images)
        if (jsonData.data?.gallery?.items) {
            return jsonData.data.gallery.items.map(item => {
                const highestRes = item.resources.reduce((highest, current) => {
                    const currentSize = parseInt(current.fsize.split('x')[0]);
                    const highestSize = parseInt(highest.fsize.split('x')[0]);
                    return currentSize > highestSize ? current : highest;
                });
                return highestRes.src;
            });
        }

        // Handle single image )
        if (jsonData.data?.links?.video) {
            const videoEntries = Object.entries(jsonData.data.links.video);
            for (const [quality, info] of videoEntries) {
                if (quality.toLowerCase().includes('image')) {
                    return info.url;
                }
            }
        }

        // Handle video
        if (jsonData.data?.links?.video) {
            const videoEntries = Object.entries(jsonData.data.links.video);
            const hdVideo = videoEntries.find(([quality]) => 
                quality.toLowerCase().includes('hd')
            );
            if (hdVideo) return hdVideo[1].url;
            return Object.values(jsonData.data.links.video)[0].url;
        }

        throw new Error('No downloadable media found in response');

    } catch (error) {
        if (error.response) {
            throw new Error(`API Error: ${error.response.status} - ${error.response.statusText}`);
        } else if (error.request) {
            throw new Error('Network error: Unable to connect to server');
        } else {
            throw new Error(`Request error: ${error.message}`);
        }
    }
}

// module.exports = instagramDownload
export default instagramDownload; **/