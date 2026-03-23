import axios, { AxiosInstance } from "axios";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";
import { exec } from "child_process";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import util from "util";

const execPromise = util.promisify(exec);

interface Item {
    type?: string;
    mediaUrl: string;
    mediaRes?: string | false;
    mediaQuality?: string;
    mediaFileSize?: string;
    mediaExtension?: string;
    mediaDuration?: string;
}

interface ApiData {
    service?: string;
    status?: string;
    message?: string;
    id?: string;
    title?: string;
    description?: string;
    imagePreviewUrl?: string;
    previewUrl?: string;
    permanentLink?: string;
    userInfo?: {
        name?: string;
        username?: string;
        userId?: string;
        userAvatar?: string;
        isVerified?: boolean;
        externalUrl?: string;
        userBio?: string;
        userCategory?: string | false;
        internalUrl?: string;
        accountCountry?: string;
        dateJoined?: string;
    };
    mediaStats?: {
        viewsCount?: string;
        mediaCount?: string;
        followersCount?: string;
        followingCount?: string | false;
        likesCount?: string | false;
        commentsCount?: string | false;
        favouritesCount?: string | false;
        sharesCount?: string | false;
        downloadsCount?: string | false;
    };
    mediaItems?: Item[];
}

interface ApiResponse {
    api?: ApiData;
}

export interface SearchResult {
    id: string;
    url: string;
    title: string;
    author: string;
    description: string;
    viewers?: string;
    verified: boolean;
    duration?: string;
    thumbnail?: string;
    moving_thumbnail?: string | null;
    avatar?: string;
    published?: string;
}

export interface VideoInfo {
    url: string;
    title: string;
    description: string;
    date: string;
    views: number;
    likes: number;
    thumbnail: string;
    tags: string;
    author: {
        name: string;
        username: string;
        subscribers: number;
        thumbnail: string;
        url: string;
    };
}

export interface Format {
    quality?: string;
    res?: string;
    size?: string;
    format?: string;
    duration?: string;
    url?: string;
}

export interface DownloadResult {
    info: {
        id?: string;
        title?: string;
        desc?: string;
        thumb?: string;
        preview?: string;
        link?: string;
        service?: string;
    };
    channel: {
        name?: string;
        user?: string;
        id?: string;
        avatar?: string;
        verified: boolean;
        site?: string;
        bio?: string;
        category?: string | false;
        internal?: string;
        country?: string;
        joined?: string;
    };
    stats: {
        views?: string;
        vids?: string;
        subs?: string;
        following?: string | false;
        likes?: string | false;
        comments?: string | false;
        favorites?: string | false;
        shares?: string | false;
        downloads?: string | false;
    };
    videos: Format[];
    audios: Format[];
}

export interface BufferResult {
    buffer: Buffer;
    mimetype: string;
    fileName: string;
}

export interface DownloadBufferOpts {
    video?: boolean;
    title?: string;
}

export interface YtDlpOpts {
    video?: boolean;
    title?: string;
    cookiesPath?: string;
}

export default class YouTube {
    public baseUrl: string;
    public jar: CookieJar;
    public client: AxiosInstance;
    private _extract: (data: string) => any;
    private _convert: (value: string) => number;

    constructor() {
        this.baseUrl = "https://app.ytdown.to";
        this.jar = new CookieJar();
        this.client = wrapper(axios.create({
            jar: this.jar,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            }
        }));
        this._extract = (data: string) =>
            data ? JSON.parse(data.split("var ytInitialData = ")[1].split("</")[0].slice(0, -1)) : new Error("No data provided");
        this._convert = (value: string) =>
            parseFloat(value.replace(/[^0-9.]/g, "")) * (value.includes("k") || value.includes("K") ? 1000 : value.includes("M") ? 1000000 : 1);
    }

    getYouTubeID(input: string): string | null {
        if (!input) return null;
        const url = new URL(input);
        const { hostname, pathname, searchParams } = url;
        const valid = /^(www\.|m\.)?youtube\.(com|co)$|youtu\.be$/.test(hostname);
        if (!valid) return input;
        if (hostname === "youtu.be") return pathname.split("/")[1] || input;
        const [, , section, id] = pathname.split("/");
        return section === "shorts" ? id : searchParams.get("v") ?? (
            ["/watch", "channel", "user"].some(p => p === pathname || section === p) ? null
                : section === "playlist" ? searchParams.get("list") : input
        );
    }

    private async pollUrl(mediaUrl: string, delay = 5000): Promise<string | null> {
        while (true) {
            const { data } = await this.client.get(mediaUrl);
            if (data?.error === "METADATA_NOT_FOUND") return null;
            if (data?.percent === "Completed" && data?.fileUrl && data.fileUrl !== "In Processing...") return data.fileUrl as string;
            await new Promise((res) => setTimeout(res, delay));
        }
    }

    private async convertToMp3(input: Buffer): Promise<Buffer> {
        const ts = Date.now();
        const inFile = `/tmp/yt_in_${ts}.m4a`;
        const outFile = `/tmp/yt_out_${ts}.mp3`;
        try {
            writeFileSync(inFile, input);
            await execPromise(`ffmpeg -y -i "${inFile}" -codec:a libmp3lame -qscale:a 2 "${outFile}"`);
            return readFileSync(outFile);
        } catch (err) {
            console.warn("[convertToMp3] ffmpeg failed — returning original buffer:", err);
            return input;
        } finally {
            try { unlinkSync(inFile); } catch {}
            try { unlinkSync(outFile); } catch {}
        }
    }

    search(query: string): Promise<SearchResult[]> {
        return new Promise(async (resolve, reject) => {
            await this.client.get("https://www.youtube.com/results", {
                headers: {
                    accept: "*/*",
                    "accept-encoding": "gzip, deflate, br",
                    "accept-language": "en-US,en;q=0.9",
                    "sec-ch-ua": '"Google Chrome";v="117", "Not;A=Brand";v="8", "Chromium";v="117"',
                    "sec-ch-ua-mobile": "?0",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
                },
                params: { search_query: query }
            }).then(({ data }) => {
                const contents = this._extract(data).contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[0].itemSectionRenderer.contents;
                const results: SearchResult[] = contents.map((content: any) => {
                    const tag = Object.keys(content)[0];
                    if (tag !== "videoRenderer") return null;
                    const d = content[tag];
                    return {
                        id: d.videoId,
                        url: `https://www.youtube.com/watch?v=${d.videoId}`,
                        title: d.title?.runs[0]?.text,
                        author: d.ownerText?.runs[0]?.text,
                        description: d.descriptionSnippet
                            ? d.descriptionSnippet.runs.map((r: any) => r.text).join("")
                            : d.detailedMetadataSnippets?.[0]?.snippetText.runs.map((r: any) => r.text).join("") ?? "",
                        viewers: d.viewCountText?.simpleText,
                        verified: d.ownerBadges?.some((b: any) => b.metadataBadgeRenderer.tooltip === "Official Artist Channel") ?? false,
                        duration: d.lengthText?.accessibility?.accessibilityData?.label,
                        thumbnail: d.thumbnail?.thumbnails[0]?.url,
                        moving_thumbnail: d.richThumbnail?.movingThumbnailRenderer?.movingThumbnailDetails?.thumbnails[0]?.url ?? null,
                        avatar: d.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails[0]?.url,
                        published: d.publishedTimeText?.simpleText
                    } as SearchResult;
                }).filter(Boolean);
                resolve(results);
            }).catch(() => reject({ status: false, message: "Error search results from YouTube" }));
        });
    }

    getInfo(url: string): Promise<VideoInfo> {
        return new Promise(async (resolve, reject) => {
            const id = this.getYouTubeID(url);
            await this.client.get("https://www.youtube.com/watch", {
                params: { v: id }
            }).then(({ data }) => {
                const c = this._extract(data).contents.twoColumnWatchNextResults.results.results.contents;
                const v = c.find((i: any) => i.videoPrimaryInfoRenderer).videoPrimaryInfoRenderer;
                const a = c.find((i: any) => i.videoSecondaryInfoRenderer).videoSecondaryInfoRenderer.owner.videoOwnerRenderer;
                resolve({
                    url: `https://www.youtube.com/watch?v=${id}`,
                    title: v.title.runs[0].text,
                    description: c.find((i: any) => i.videoSecondaryInfoRenderer)?.videoSecondaryInfoRenderer?.attributedDescription?.content ?? "No description",
                    date: v.dateText.simpleText,
                    views: this._convert(v.viewCount.videoViewCountRenderer.viewCount.simpleText),
                    likes: this._convert(v.videoActions?.menuRenderer?.topLevelButtons?.find((btn: any) => btn.segmentedLikeDislikeButtonViewModel?.likeButtonViewModel?.likeButtonViewModel)?.segmentedLikeDislikeButtonViewModel.likeButtonViewModel.likeButtonViewModel.toggleButtonViewModel.toggleButtonViewModel.toggledButtonViewModel.buttonViewModel.title),
                    thumbnail: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
                    tags: v.superTitleLink?.runs.map((t: any) => t.text).join(", ") ?? "No tags",
                    author: {
                        name: a.title.runs[0].text,
                        username: a.navigationEndpoint.browseEndpoint.canonicalBaseUrl.replace("/", ""),
                        subscribers: this._convert(a.subscriberCountText.simpleText),
                        thumbnail: a.thumbnail.thumbnails.at(-1).url,
                        url: `https://www.youtube.com${a.navigationEndpoint.browseEndpoint.canonicalBaseUrl}`
                    }
                });
            }).catch(reject);
        });
    }

    download_v1(url: string): Promise<DownloadResult> {
        return new Promise(async (resolve, reject) => {
            if (!url) return reject(new Error("URL is required"));
            this.client.post<ApiResponse>(
                `${this.baseUrl}/proxy.php`,
                new URLSearchParams({ url }).toString(),
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                        Accept: "*/*",
                        "X-Requested-With": "XMLHttpRequest",
                        Referer: `${this.baseUrl}/`,
                    },
                }
            ).then(async ({ data }) => {
                const api = data?.api;
                if (!api) return reject(new Error("API response error"));
                if (api.status === "ERROR") return reject(new Error(api.message ?? "Unknown API error"));

                const items = api.mediaItems ?? [];

                const videos: Format[] = await Promise.all(
                    items.filter(i => i.type === "Video").map(async item => ({
                        quality: item.mediaQuality,
                        res: item.mediaRes || undefined,
                        size: item.mediaFileSize,
                        format: item.mediaExtension,
                        duration: item.mediaDuration,
                        url: (await this.pollUrl(item.mediaUrl)) || undefined,
                    }))
                );

                const audios: Format[] = await Promise.all(
                    items.filter(i => i.type === "Audio").map(async item => ({
                        quality: item.mediaQuality,
                        size: item.mediaFileSize,
                        format: item.mediaExtension,
                        duration: item.mediaDuration,
                        url: (await this.pollUrl(item.mediaUrl)) || undefined,
                    }))
                );

                resolve({
                    info: {
                        id: api.id,
                        title: api.title,
                        desc: api.description,
                        thumb: api.imagePreviewUrl,
                        preview: api.previewUrl,
                        link: api.permanentLink,
                        service: api.service,
                    },
                    channel: {
                        name: api.userInfo?.name,
                        user: api.userInfo?.username,
                        id: api.userInfo?.userId,
                        avatar: api.userInfo?.userAvatar,
                        verified: api.userInfo?.isVerified || false,
                        site: api.userInfo?.externalUrl,
                        bio: api.userInfo?.userBio,
                        category: api.userInfo?.userCategory,
                        internal: api.userInfo?.internalUrl,
                        country: api.userInfo?.accountCountry,
                        joined: api.userInfo?.dateJoined,
                    },
                    stats: {
                        views: api.mediaStats?.viewsCount,
                        vids: api.mediaStats?.mediaCount,
                        subs: api.mediaStats?.followersCount,
                        following: api.mediaStats?.followingCount,
                        likes: api.mediaStats?.likesCount,
                        comments: api.mediaStats?.commentsCount,
                        favorites: api.mediaStats?.favouritesCount,
                        shares: api.mediaStats?.sharesCount,
                        downloads: api.mediaStats?.downloadsCount,
                    },
                    videos: videos.filter(v => v.url),
                    audios: audios.filter(a => a.url),
                });
            }).catch(reject);
        });
    }

    download_v2(url: string, opts: DownloadBufferOpts = {}): Promise<BufferResult> {
        return new Promise(async (resolve, reject) => {
            if (!url) return reject(new Error("URL is required"));
            const { video = false, title } = opts;

            try {
                const { data } = await axios.post(
                    `${this.baseUrl}/proxy.php`,
                    new URLSearchParams({ url }),
                    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
                );

                const api = data?.api as ApiData;
                if (api?.status === "ERROR") return reject(new Error(api.message ?? "Unknown API error"));

                const media = api?.mediaItems?.find(m => m.type?.toLowerCase() === (video ? "video" : "audio"));
                if (!media) return reject(new Error(`Media type "${video ? "video" : "audio"}" not found`));

                let fileUrl: string | null = null;
                while (true) {
                    const { data: res } = await axios.get(media.mediaUrl);
                    if (res?.error === "METADATA_NOT_FOUND") return reject(new Error("Metadata not found"));
                    if (res?.percent === "Completed" && res?.fileUrl && res.fileUrl !== "In Processing...") {
                        fileUrl = res.fileUrl;
                        break;
                    }
                    await new Promise(res => setTimeout(res, 5000));
                }

                const { data: raw } = await axios.get(fileUrl!, { responseType: "arraybuffer" });
                const buffer = Buffer.from(raw);

                const safeTitle = (title ?? api.title ?? "yt").replace(/[\\/:*?"<>|]/g, "").slice(0, 60) || "yt";
                resolve({
                    buffer,
                    mimetype: video ? "video/mp4" : "audio/x-m4a",
                    fileName: `${safeTitle}.${video ? "mp4" : "m4a"}`,
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    download_v3(url: string, opts: YtDlpOpts = {}): Promise<BufferResult> {
        return new Promise(async (resolve, reject) => {
            if (!url) return reject(new Error("URL is required"));
            const { video = false, title = "youtube", cookiesPath = join(process.cwd(), "cookies.txt") } = opts;

            try {
                const format = video ? "best[ext=mp4][height<=360]" : "bestaudio[ext=m4a]";
                const outputExt = video ? "mp4" : "m4a";
                const outFile = `/tmp/yt_${Date.now()}.${outputExt}`;

                const args: string[] = [
                    "--js-runtimes", "deno",
                    "--remote-components", "ejs:npm",
                    "-f", format,
                    "-o", outFile,
                ];

                try { readFileSync(cookiesPath); args.unshift("--cookies", cookiesPath); }
                catch { console.warn("[download_v3] cookies.txt not found — proceeding without cookies."); }

                args.push(url);
                const cmd = `yt-dlp ${args.map(a => `"${a}"`).join(" ")}`;
                console.log("[yt-dlp cmd]", cmd);

                await execPromise(cmd, { maxBuffer: 300 * 1024 * 1024 });

                const buffer = readFileSync(outFile);
                unlinkSync(outFile);

                const safeTitle = (title || "yt").replace(/[\\/:*?"<>|]/g, "").slice(0, 60) || "yt";
                resolve({
                    buffer,
                    mimetype: video ? "video/mp4" : "audio/x-m4a",
                    fileName: `${safeTitle}.${outputExt}`,
                });
            } catch (err) {
                reject(err);
            }
        });
    }
}