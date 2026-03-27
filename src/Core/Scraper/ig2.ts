import axios from 'axios';

export default new class InstagramV2 {
    private readonly apiUrl = 'https://ssvid.net/api/ajax/search?hl=en';
    
    private readonly headers = {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': '*/*',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36'
    };

    async download(instagramUrl: string): Promise<string | string[]> {
        const data = new URLSearchParams();
        data.append('query', instagramUrl);

        try {
            const response = await axios.post(this.apiUrl, data, { headers: this.headers });
            const jsonData = response.data;

            // Handle gallery (multiple images)
            if (jsonData.data?.gallery?.items) {
                return jsonData.data.gallery.items.map((item: any) => {
                    const highestRes = item.resources.reduce((highest: any, current: any) => {
                        const currentSize = parseInt(current.fsize.split('x')[0]);
                        const highestSize = parseInt(highest.fsize.split('x')[0]);
                        return currentSize > highestSize ? current : highest;
                    });
                    return highestRes.src;
                });
            }

            // Handle single image
            if (jsonData.data?.links?.video) {
                const videoEntries = Object.entries(jsonData.data.links.video);
                for (const [quality, info] of videoEntries) {
                    if (quality.toLowerCase().includes('image')) {
                        return (info as any).url;
                    }
                }
            }

            // Handle video
            if (jsonData.data?.links?.video) {
                const videoEntries = Object.entries(jsonData.data.links.video);
                const hdVideo = videoEntries.find(([quality]) => 
                    quality.toLowerCase().includes('hd')
                );
                if (hdVideo) return (hdVideo[1] as any).url;
                return (Object.values(jsonData.data.links.video)[0] as any).url;
            }

            throw new Error('No downloadable media found in response');

        } catch (error: any) {
            if (error.response) {
                throw new Error(`API Error: ${error.response.status} - ${error.response.statusText}`);
            } else if (error.request) {
                throw new Error('Network error: Unable to connect to server');
            } else {
                throw new Error(`Request error: ${error.message}`);
            }
        }
    }
}