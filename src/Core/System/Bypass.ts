import * as http2 from 'http2';
import * as tls from 'tls';
import { URL } from 'url';
import * as crypto from 'crypto';
import * as net from 'net';

export interface BypassOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: Buffer | string;
    timeout?: number;
    proxy?: string; // Format: host:port or user:pass@host:port
}

class Bypass {
    private readonly defaultCiphers = crypto.constants.defaultCoreCipherList.split(":");
    private readonly ciphers = [
        this.defaultCiphers[2],
        this.defaultCiphers[1],
        this.defaultCiphers[0],
        ...this.defaultCiphers.slice(3)
    ].join(":");

    private readonly sigalgs = "ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:rsa_pss_rsae_sha512:rsa_pkcs1_sha512";
    private readonly ecdhCurves = "X25519:P-256:P-384:P-521";

    private readonly secureOptions = 
        crypto.constants.SSL_OP_NO_SSLv2 |
        crypto.constants.SSL_OP_NO_SSLv3 |
        crypto.constants.SSL_OP_NO_TLSv1 |
        crypto.constants.SSL_OP_NO_TLSv1_1 |
        crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION |
        crypto.constants.SSL_OP_CIPHER_SERVER_PREFERENCE |
        crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT |
        crypto.constants.SSL_OP_COOKIE_EXCHANGE |
        crypto.constants.SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION;

    private getRandomInt(min: number, max: number) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    private randomElement<T>(elements: T[]): T {
        return elements[this.getRandomInt(0, elements.length - 1)];
    }

    private generateLegitIP(): string {
        const ips = ["8.8.8.", "13.107.21.", "104.18.32.", "162.158.78.", "3.120.0.", "52.192.0.", "13.37.0.", "1.201.0.", "101.226.0."];
        return `${this.randomElement(ips)}${this.getRandomInt(1, 254)}`;
    }

    private getH2Settings(browser: string) {
        const settings: Record<string, any> = {
            chrome: {
                headerTableSize: 65536,
                enablePush: false,
                maxConcurrentStreams: 1000,
                initialWindowSize: 6291456,
                maxFrameSize: 16384,
                maxHeaderListSize: 262144
            },
            brave: {
                headerTableSize: 65536,
                enablePush: false,
                maxConcurrentStreams: 500,
                initialWindowSize: 6291456,
                maxFrameSize: 16384,
                maxHeaderListSize: 262144
            },
            firefox: {
                headerTableSize: 65536,
                enablePush: false,
                maxConcurrentStreams: 100,
                initialWindowSize: 6291456,
                maxFrameSize: 16384,
                maxHeaderListSize: 262144
            },
            safari: {
                headerTableSize: 4096,
                enablePush: false,
                maxConcurrentStreams: 100,
                initialWindowSize: 6291456,
                maxFrameSize: 16384,
                maxHeaderListSize: 262144
            }
        };
        return settings[browser] || settings.chrome;
    }

    private generateHeaders(targetUrl: string, browser: string): Record<string, string> {
        const parsedUrl = new URL(targetUrl);
        const chromeVersion = this.getRandomInt(120, 126);
        
        const baseHeaders: Record<string, any> = {
            chrome: {
                'sec-ch-ua': `"Google Chrome";v="${chromeVersion}", "Chromium";v="${chromeVersion}", "Not-A.Brand";v="99"`,
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'user-agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36`,
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'sec-fetch-site': 'none',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-user': '?1',
                'sec-fetch-dest': 'document',
                'accept-encoding': 'gzip, deflate, br, zstd',
                'accept-language': 'en-US,en;q=0.9',
                'priority': 'u=0, i',
            },
            brave: {
                'sec-ch-ua': `"Brave";v="${chromeVersion}", "Chromium";v="${chromeVersion}", "Not-A.Brand";v="99"`,
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'user-agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36 Brave/${chromeVersion}.0.0.0`,
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'sec-fetch-site': 'same-origin',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-user': '?1',
                'sec-fetch-dest': 'document',
                'accept-encoding': 'gzip, deflate, br, zstd',
                'accept-language': 'en-US,en;q=0.9',
            },
            firefox: {
                'user-agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0`,
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'accept-language': 'en-US,en;q=0.5',
                'accept-encoding': 'gzip, deflate, br, zstd',
                'upgrade-insecure-requests': '1',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'none',
                'sec-fetch-user': '?1',
                'priority': 'u=1',
            }
        };

        const selectedHeaders = baseHeaders[browser] || baseHeaders.chrome;

        return {
            ':authority': parsedUrl.hostname,
            ':scheme': 'https',
            ':path': parsedUrl.pathname + parsedUrl.search,
            ...selectedHeaders,
            'x-forwarded-for': this.generateLegitIP(),
            'x-real-ip': this.generateLegitIP(),
            'cache-control': 'max-age=0',
        };
    }

    private shuffleObject(obj: Record<string, string>): Record<string, string> {
        const keys = Object.keys(obj);
        for (let i = keys.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [keys[i], keys[j]] = [keys[j], keys[i]];
        }
        const shuffled: Record<string, string> = {};
        keys.forEach(key => shuffled[key] = obj[key]);
        return shuffled;
    }

    public async request(targetUrl: string, options: BypassOptions = {}): Promise<Buffer> {
        return new Promise(async (resolve, reject) => {
            try {
                const parsedUrl = new URL(targetUrl);
                const method = options.method || 'GET';
                const timeout = options.timeout || 30000;
                const browsers = ['chrome', 'brave', 'firefox'];
                const browser = this.randomElement(browsers);

                const tlsOptions: tls.ConnectionOptions = {
                    host: parsedUrl.hostname,
                    port: 443,
                    ALPNProtocols: ['h2'],
                    servername: parsedUrl.hostname,
                    ciphers: this.ciphers,
                    sigalgs: this.sigalgs,
                    ecdhCurve: this.ecdhCurves,
                    secureOptions: this.secureOptions,
                    honorCipherOrder: false,
                    rejectUnauthorized: false,
                    minVersion: 'TLSv1.2',
                    maxVersion: 'TLSv1.3'
                };

                let connection: net.Socket;

                if (options.proxy) {
                    const [proxyHost, proxyPort] = options.proxy.split(':');
                    connection = net.connect(Number(proxyPort), proxyHost);

                    const connectPayload = `CONNECT ${parsedUrl.hostname}:443 HTTP/1.1\r\nHost: ${parsedUrl.hostname}:443\r\nProxy-Connection: Keep-Alive\r\n\r\n`;
                    
                    connection.on('connect', () => {
                        connection.write(connectPayload);
                    });

                    connection.on('data', (chunk) => {
                        if (chunk.toString().includes('HTTP/1.1 200')) {
                            this.startTls(connection, parsedUrl, tlsOptions, method, browser, options, resolve, reject);
                        } else if (!chunk.toString().includes('HTTP/1.1')) {
                            // Keep waiting
                        } else {
                            connection.destroy();
                            reject(new Error('Proxy connection failed: ' + chunk.toString().split('\r\n')[0]));
                        }
                    });
                } else {
                    connection = net.connect(443, parsedUrl.hostname);
                    connection.on('connect', () => {
                        this.startTls(connection, parsedUrl, tlsOptions, method, browser, options, resolve, reject);
                    });
                }

                connection.on('error', (err) => reject(err));
                
                const timeoutTimer = setTimeout(() => { 
                    if (connection) connection.destroy(); 
                    reject(new Error('Request timeout')); 
                }, timeout);

                // Ensure we clear timeout if resolved/rejected
                const originalResolve = resolve;
                const originalReject = reject;
                resolve = (val) => { clearTimeout(timeoutTimer); originalResolve(val); };
                reject = (err) => { clearTimeout(timeoutTimer); originalReject(err); };

            } catch (error) {
                reject(error);
            }
        });
    }

    private startTls(
        socket: net.Socket, 
        parsedUrl: URL, 
        tlsOptions: tls.ConnectionOptions, 
        method: string, 
        browser: string,
        options: BypassOptions,
        resolve: (value: Buffer | PromiseLike<Buffer>) => void,
        reject: (reason?: any) => void
    ) {
        const tlsConn = tls.connect({
            ...tlsOptions,
            socket: socket,
            servername: parsedUrl.hostname
        });

        tlsConn.on('secureConnect', () => {
            const client = http2.connect(parsedUrl.origin, {
                createConnection: () => tlsConn,
                settings: this.getH2Settings(browser)
            });

            const rawHeaders = {
                ':method': method,
                ...this.generateHeaders(parsedUrl.href, browser),
                ...options.headers
            };

            const pseudoHeaders: Record<string, string> = {};
            const normalHeaders: Record<string, string> = {};
            
            Object.entries(rawHeaders).forEach(([key, value]) => {
                if (key.startsWith(':')) pseudoHeaders[key] = value as string;
                else normalHeaders[key] = value as string;
            });

            const headers = {
                ...pseudoHeaders,
                ...this.shuffleObject(normalHeaders)
            };

            const req = client.request(headers);

            let chunks: Buffer[] = [];
            req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            req.on('end', () => {
                client.close();
                socket.destroy();
                resolve(Buffer.concat(chunks));
            });

            req.on('error', (err) => {
                client.close();
                socket.destroy();
                reject(err);
            });

            if (options.body) req.write(options.body);
            req.end();
        });

        tlsConn.on('error', (err) => {
            socket.destroy();
            reject(err);
        });
    }
}

export default new Bypass();
