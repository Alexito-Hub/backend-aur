import * as fs from 'fs';
import * as path from 'path';
import Bypass from '../System/Bypass';

export default new class Photoroom {
    private readonly apiKey = '10148f33e3f8d09a9b9aa6b775372a4ebf18b938';
    private readonly apiUrl = 'https://sdk.photoroom.com/v1/segment';

    /**
     * Remove background from an image using Photoroom SDK.
     * @param imagePath Path to the local image file.
     * @param token Optional Cloudflare Turnstile token.
     */
    public async removebg(imagePath: string, token: string = ''): Promise<Buffer> {
        if (!fs.existsSync(imagePath)) {
            throw new Error(`File not found: ${imagePath}`);
        }

        const imageBuffer = fs.readFileSync(imagePath);
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        
        const body = Buffer.concat([
            Buffer.from(`--${boundary}\r\n`),
            Buffer.from(`Content-Disposition: form-data; name="image_file"; filename="image.png"\r\n`),
            Buffer.from(`Content-Type: image/png\r\n\r\n`),
            imageBuffer,
            Buffer.from(`\r\n--${boundary}--\r\n`)
        ]);

        const headers: Record<string, string> = {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'X-Api-Key': this.apiKey,
        };

        if (token) {
            headers['X-Captcha'] = `CLOUDFLARE_${token}`;
        }

        try {
            const response = await Bypass.request(this.apiUrl, {
                method: 'POST',
                headers: headers,
                body: body
            });

            // The API returns the raw binary image data on success
            return response;
        } catch (error: any) {
            console.error('Photoroom Error:', error.message);
            throw new Error(`Failed to remove background: ${error.message}`);
        }
    }
}
