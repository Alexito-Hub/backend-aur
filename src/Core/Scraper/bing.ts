import axios, { AxiosInstance } from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import * as crypto from 'crypto';
import qs from 'qs';

const BASE_URL = 'https://www.bing.com/images/create';
const BING_ORIGIN = 'https://www.bing.com';
const IMAGE_HOST = 'https://th.bing.com';

const POLL_INTERVAL = 5000;
const POLL_INTERVAL_GPT4O = 3000;

const REJECTION_MARKERS = [
    'girer_center block_icon',
    'data-clarity-tag="BlockedByContentPolicy"',
    'dq-err="',
];

const AUTH_MARKER = 'id="id_a" style="display:none"';
const GPT4O_STREAMING_MARKER = 'imgri-inner-container strm';

export enum BingModel {
    DALLE = 0,
    GPT4O = 1,
    MAI1 = 4
}

export enum BingAspect {
    SQUARE = 1,
    LANDSCAPE = 2,
    PORTRAIT = 3
}

const MODEL_MAP: Record<string, number> = { DALLE: 0, GPT4O: 1, MAI1: 4 };
const ASPECT_MAP: Record<string, number> = { SQUARE: 1, LANDSCAPE: 2, PORTRAIT: 3 };
const MODEL_BODY_MAP: Record<number, string> = { 0: 'dalle', 1: 'gpt4o', 4: 'maiimage1' };
const ASPECT_BODY_MAP: Record<number, string> = { 1: '1:1', 2: '7:4', 3: '4:7' };

const RE_IG = /IG:"([^"]+)"/;
const RE_SALT = /Salt:"([^"]+)"/;
const RE_ID = /id=([^&"]+)/;
const RE_SELCAP = /data-selcap="([^"]+)"/;
const RE_ALT = /<img[^>]*class="image-row-img[^"]*"[^>]*alt="([^"]+)"/;
const RE_SRC_ANY = /src="([^"]+)"/g;
const RE_VIDEO_URL = /ourl="([^"]+)"/;

export class AuthCookieError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthCookieError';
    }
}

export class PromptRejectedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PromptRejectedError';
    }
}

interface VideoTask {
    id: string;
    query: string;
    requestId: string;
    status: 'processing' | 'completed' | 'failed';
    createdAt: string;
    completedAt?: string;
    video: string | null;
    error: string | null;
}

export interface ImageResult {
    images: string[];
    prompt: string;
    model: string;
    aspect: string;
}

export interface VideoResult {
    taskId: string;
    prompt: string;
}

export interface GenericResult {
    type: 'image' | 'video';
    images?: string[];
    video?: string;
    prompt: string;
    model?: string;
    aspect?: string;
}

export class BingCreate {
    private cookieU: string;
    private IG: string | null = null;
    private salt: string | null = null;
    private jar: CookieJar;
    private http: AxiosInstance;
    private videoTasks: Map<string, VideoTask> = new Map();

    private headers = {
        'authority': 'www.bing.com',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'content-type': 'application/x-www-form-urlencoded',
        'origin': BING_ORIGIN,
        'referer': BASE_URL,
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    };

    constructor(cookieU: string = '') {
        this.cookieU = cookieU;
        this.jar = new CookieJar();
        this.http = wrapper(axios.create({
            jar: this.jar,
            validateStatus: (status) => status >= 200 && status < 400
        }));
    }

    setCookie(cookieU: string) {
        this.cookieU = cookieU;
    }

    private checkCookie() {
        if (!this.cookieU || this.cookieU.trim() === '') {
            throw new AuthCookieError('Cookie _U is not set.');
        }
    }

    async setup() {
        this.checkCookie();

        this.jar = new CookieJar();
        this.http = wrapper(axios.create({
            jar: this.jar,
            validateStatus: (status) => status >= 200 && status < 400
        }));

        this.jar.setCookieSync(
            `_U=${this.cookieU}; Domain=.bing.com; Path=/`,
            'https://www.bing.com'
        );

        const res = await this.http.get(BASE_URL, { headers: this.headers });
        const html = res.data;

        if (typeof html === 'string' && !html.includes(AUTH_MARKER)) {
            throw new AuthCookieError('Authentication failed. _U cookie is invalid or expired.');
        }

        const igMatch = RE_IG.exec(html);
        const saltMatch = RE_SALT.exec(html);
        if (igMatch) this.IG = igMatch[1];
        if (saltMatch) this.salt = saltMatch[1];

        const srchhpgusr = `SRCHLANG=ru&HV=${Math.floor(Date.now() / 1000)}&HVE=${this.salt || ''}&IG=${this.IG || ''}`;
        this.jar.setCookieSync(
            `SRCHHPGUSR=${encodeURIComponent(srchhpgusr)}; Domain=.bing.com; Path=/`,
            'https://www.bing.com'
        );
    }

    async submit(params: URLSearchParams, payload: URLSearchParams, referer: string) {
        const url = `${BASE_URL}?${params.toString()}`;
        
        let res;
        try {
            res = await this.http.post(url, payload.toString(), {
                headers: { ...this.headers, 'referer': referer },
                maxRedirects: 0,
                validateStatus: (status) => status >= 200 && status < 400
            });
        } catch (error: any) {
            if (error.response && error.response.status >= 300 && error.response.status < 400) {
                res = error.response;
            } else {
                throw error;
            }
        }

        const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        this.checkRejected(html);

        let redirectUrl = res.headers['location'] || html;
        if (typeof redirectUrl === 'string' && redirectUrl.startsWith('/')) {
            redirectUrl = `${BING_ORIGIN}${redirectUrl}`;
        }

        const idMatch = RE_ID.exec(redirectUrl);
        if (!idMatch) throw new AuthCookieError('Auth failed or generic error.');

        if (res.headers['location']) {
            const rRes = await this.http.get(redirectUrl, { headers: this.headers });
            this.checkRejected(rRes.data);
        }

        return idMatch[1];
    }

    async pollImages(query: string, requestId: string, modelValue: number): Promise<{ images: string[], enhancedPrompt: string | null }> {
        const interval = modelValue === BingModel.GPT4O ? POLL_INTERVAL_GPT4O : POLL_INTERVAL;
        const encoded = new URLSearchParams({ q: query }).toString();

        while (true) {
            const url = `${BASE_URL}/async/results/${requestId}?${encoded}&IG=${this.IG}&IID=images.as`;
            const res = await this.http.get(url, { headers: this.headers });
            const html = res.data;
            this.checkRejected(html);

            if (typeof html === 'string') {
                if (!html.includes('text/css')) {
                    await this.sleep(interval);
                    continue;
                }

                if (modelValue === BingModel.GPT4O && html.includes(GPT4O_STREAMING_MARKER)) {
                    await this.sleep(interval);
                    continue;
                }

                const images = this.parseImageUrls(html);
                if (images.length) return { images, enhancedPrompt: this.parseEnhancedPrompt(html) };
            }

            await this.sleep(interval);
        }
    }

    async pollVideo(query: string, requestId: string): Promise<string> {
        const encoded = new URLSearchParams({ q: query }).toString();

        while (true) {
            const url = `${BASE_URL}/async/results/${requestId}?${encoded}&IG=${this.IG}&ctype=video&sm=1&girftp=1`;
            const res = await this.http.get(url, { headers: this.headers });
            const html = res.data;
            
            if (typeof html === 'string') {
                this.checkRejected(html);

                if (html.includes('errorMessage') && html.includes('Pending')) {
                    await this.sleep(POLL_INTERVAL);
                    continue;
                }

                if (html.includes('showContent')) {
                    try {
                        const data = JSON.parse(html);
                        if (data?.showContent) return data.showContent;
                    } catch (_) {}
                }

                const m = RE_VIDEO_URL.exec(html);
                if (m) return m[1];
            } else if (typeof html === 'object') {
                if (html?.showContent) return html.showContent;
            }

            await this.sleep(POLL_INTERVAL);
        }
    }

    private createVideoTask(query: string, requestId: string): string {
        const taskId = crypto.randomUUID();
        this.videoTasks.set(taskId, {
            id: taskId,
            query,
            requestId,
            status: 'processing',
            createdAt: new Date().toISOString(),
            video: null,
            error: null,
        });

        this.pollVideoTask(taskId, query, requestId);

        return taskId;
    }

    private async pollVideoTask(taskId: string, query: string, requestId: string) {
        try {
            const video = await this.pollVideo(query, requestId);
            const task = this.videoTasks.get(taskId);
            if (task) {
                task.status = 'completed';
                task.video = video;
                task.completedAt = new Date().toISOString();
            }
        } catch (error: any) {
            const task = this.videoTasks.get(taskId);
            if (task) {
                task.status = 'failed';
                task.error = error.message;
                task.completedAt = new Date().toISOString();
            }
        }
    }

    getVideoTask(taskId: string): VideoTask | null {
        return this.videoTasks.get(taskId) || null;
    }

    async createImage(query: string, options: { model?: string | number, aspect?: string | number } = {}): Promise<ImageResult> {
        this.checkCookie();
        if (!this.IG) await this.setup();

        const mdlValue = this.resolveModel(options.model ?? 'DALLE');
        const arValue = this.resolveAspect(options.aspect ?? 'SQUARE');

        const { params, payload, referer } = this.buildImageRequest(query, mdlValue, arValue);
        const requestId = await this.submit(params, payload, referer);

        const result = await this.pollImages(query, requestId, mdlValue);
        return {
            images: result.images,
            prompt: result.enhancedPrompt || query,
            model: this.resolveModelName(mdlValue),
            aspect: this.resolveAspectName(arValue),
        };
    }

    async createVideo(query: string): Promise<VideoResult> {
        this.checkCookie();
        if (!this.IG) await this.setup();

        const { params, payload, referer } = this.buildVideoRequest(query);
        const requestId = await this.submit(params, payload, referer);
        const taskId = this.createVideoTask(query, requestId);

        return {
            taskId,
            prompt: query,
        };
    }

    async create(query: string, options: { model?: string | number, aspect?: string | number, type?: 'image' | 'video' } = {}): Promise<GenericResult> {
        this.checkCookie();
        if (!this.IG) await this.setup();

        const type = options.type || 'image';
        const mdlValue = this.resolveModel(options.model ?? 'DALLE');
        const arValue = this.resolveAspect(options.aspect ?? 'SQUARE');

        const { params, payload, referer } = this.buildRequest(query, mdlValue, arValue, type);
        const requestId = await this.submit(params, payload, referer);

        if (type === 'video') {
            const result = await this.pollVideo(query, requestId);
            return { type: 'video', video: result, prompt: query };
        }

        const result = await this.pollImages(query, requestId, mdlValue);
        return {
            type: 'image',
            images: result.images,
            prompt: result.enhancedPrompt || query,
            model: this.resolveModelName(mdlValue),
            aspect: this.resolveAspectName(arValue),
        };
    }

    private buildImageRequest(query: string, mdlValue: number, arValue: number) {
        const params = new URLSearchParams({ q: query, FORM: 'GENCRE' });
        if (this.IG) params.set('IG', this.IG);

        params.set('rt', mdlValue === 0 ? '3' : '4');
        params.set('mdl', String(mdlValue));
        params.set('ar', String(arValue));

        const payload = new URLSearchParams({
            q: query,
            model: MODEL_BODY_MAP[mdlValue] || 'dalle',
            aspectRatio: ASPECT_BODY_MAP[arValue] || '1:1',
        });

        return { params, payload, referer: BASE_URL };
    }

    private buildVideoRequest(query: string) {
        const params = new URLSearchParams({ q: query, FORM: 'GENCRE' });
        if (this.IG) params.set('IG', this.IG);

        params.set('rt', '3');
        params.set('mdl', '0');
        params.set('ar', '1');
        params.set('ctype', 'video');
        params.set('pt', '3');
        params.set('sm', '0');

        const payload = new URLSearchParams({
            q: query,
            model: 'dalle',
            aspectRatio: '1:1'
        });

        return { params, payload, referer: `${BASE_URL}?ctype=video` };
    }

    private buildRequest(query: string, mdlValue: number, arValue: number, type: 'image' | 'video') {
        const params = new URLSearchParams({ q: query, FORM: 'GENCRE' });
        if (this.IG) params.set('IG', this.IG);

        let payload, referer;

        if (type === 'video') {
            referer = `${BASE_URL}?ctype=video`;
            params.set('rt', '3');
            params.set('mdl', '0');
            params.set('ar', '1');
            params.set('ctype', 'video');
            params.set('pt', '3');
            params.set('sm', '0');
            payload = new URLSearchParams({ q: query, model: 'dalle', aspectRatio: '1:1' });
        } else {
            referer = BASE_URL;
            params.set('rt', mdlValue === 0 ? '3' : '4');
            params.set('mdl', String(mdlValue));
            params.set('ar', String(arValue));
            payload = new URLSearchParams({
                q: query,
                model: MODEL_BODY_MAP[mdlValue] || 'dalle',
                aspectRatio: ASPECT_BODY_MAP[arValue] || '1:1',
            });
        }

        return { params, payload, referer };
    }

    private resolveModel(model: string | number): number {
        if (typeof model === 'number') return model;
        const key = String(model).toUpperCase();
        if (!(key in MODEL_MAP)) throw new Error(`Invalid model: ${model}. Use DALLE, GPT4O, MAI1 or 0,1,4.`);
        return MODEL_MAP[key];
    }

    private resolveAspect(aspect: string | number): number {
        if (typeof aspect === 'number') return aspect;
        const key = String(aspect).toUpperCase();
        if (!(key in ASPECT_MAP)) throw new Error(`Invalid aspect: ${aspect}. Use SQUARE, LANDSCAPE, PORTRAIT or 1,2,3.`);
        return ASPECT_MAP[key];
    }

    private resolveModelName(value: number): string {
        return Object.keys(MODEL_MAP).find((k) => MODEL_MAP[k] === value) || String(value);
    }

    private resolveAspectName(value: number): string {
        return Object.keys(ASPECT_MAP).find((k) => ASPECT_MAP[k] === value) || String(value);
    }

    private parseEnhancedPrompt(html: string): string | null {
        const m = RE_SELCAP.exec(html) || RE_ALT.exec(html);
        return m ? m[1] : null;
    }

    private parseImageUrls(html: string): string[] {
        const srcUrls: string[] = [];

        let m;
        const r = new RegExp(RE_SRC_ANY.source, 'g');
        while ((m = r.exec(html))) srcUrls.push(m[1]);

        return srcUrls
            .map((src) => {
                const full = src.startsWith('/') ? `${IMAGE_HOST}${src}` : src;
                if (!full.includes('?') && !full.includes('/th/id/')) return null;
                const base = full.includes('?') ? full.split('?')[0] : full;
                return `${base}?pid=ImgGn`;
            })
            .filter((url): url is string => url !== null);
    }

    private checkRejected(html: string) {
        if (typeof html === 'string' && REJECTION_MARKERS.some((m) => html.includes(m))) {
            throw new PromptRejectedError('Prompt rejected for content policy.');
        }
    }

    private sleep(ms: number) {
        return new Promise((r) => setTimeout(r, ms));
    }
}

export default new BingCreate();
