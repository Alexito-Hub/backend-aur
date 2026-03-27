import axios, { AxiosInstance } from "axios";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";
import { exec } from "child_process";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
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
    mediaTask?: string;
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
    public baseUrl = "https://app.ytdown.to";
    public jar = new CookieJar();
    public client = wrapper(axios.create({
        jar: this.jar,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" }
    }));
    private _extract = (data: string) => data ? JSON.parse(data.split("var ytInitialData = ")[1].split("</")[0].slice(0, -1)) : new Error("No data");
    private _convert = (v: string) => parseFloat(v.replace(/[^0-9.]/g, "")) * (v.includes("k") ? 1000 : v.includes("M") ? 1000000 : 1);

    getYouTubeID(input: string): string | null {
        if (!input) return null;
        try {
            const url = new URL(input);
            const { hostname, pathname, searchParams } = url;
            if (hostname === "youtu.be") return pathname.split("/")[1];
            const [, , section, id] = pathname.split("/");
            return section === "shorts" ? id : searchParams.get("v") || (["playlist", "watch"].includes(section) ? searchParams.get("list") || searchParams.get("v") : null);
        } catch { return input; }
    }

    private async pollUrl(mediaUrl: string, delay = 5000, maxRetries = 40): Promise<string | null> {
        const h = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Referer": `${this.baseUrl}/`, "X-Requested-With": "XMLHttpRequest" };
        for (let i = 0; i < maxRetries; i++) {
            try {
                const { data, headers: rh } = await this.client.get(mediaUrl, { headers: h });
                if (!rh["content-type"]?.includes("application/json")) return mediaUrl;
                if (data?.percent === "Completed" && data?.fileUrl && data.fileUrl !== "In Processing...") return data.fileUrl;
            } catch { }
            await new Promise(r => setTimeout(r, delay));
        }
        return null;
    }

    async search(query: string): Promise<SearchResult[]> {
        const { data } = await this.client.get("https://www.youtube.com/results", { params: { search_query: query } });
        const contents = this._extract(data).contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[0].itemSectionRenderer.contents;
        return contents.map((c: any) => {
            const d = c.videoRenderer;
            if (!d) return null;
            return {
                id: d.videoId,
                url: `https://www.youtube.com/watch?v=${d.videoId}`,
                title: d.title?.runs[0]?.text,
                author: d.ownerText?.runs[0]?.text,
                description: d.descriptionSnippet?.runs.map((r: any) => r.text).join("") || "",
                viewers: d.viewCountText?.simpleText,
                verified: d.ownerBadges?.some((b: any) => b.metadataBadgeRenderer.tooltip === "Official Artist Channel") || false,
                duration: d.lengthText?.accessibility?.accessibilityData?.label,
                thumbnail: d.thumbnail?.thumbnails[0]?.url,
                avatar: d.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails[0]?.url,
                published: d.publishedTimeText?.simpleText
            };
        }).filter(Boolean);
    }

    async getInfo(url: string): Promise<VideoInfo> {
        const id = this.getYouTubeID(url);
        const { data } = await this.client.get("https://www.youtube.com/watch", { params: { v: id } });
        const c = this._extract(data).contents.twoColumnWatchNextResults.results.results.contents;
        const v = c.find((i: any) => i.videoPrimaryInfoRenderer).videoPrimaryInfoRenderer;
        const a = c.find((i: any) => i.videoSecondaryInfoRenderer).videoSecondaryInfoRenderer.owner.videoOwnerRenderer;
        return {
            url: `https://www.youtube.com/watch?v=${id}`,
            title: v.title.runs[0].text,
            description: c.find((i: any) => i.videoSecondaryInfoRenderer)?.videoSecondaryInfoRenderer?.attributedDescription?.content || "No description",
            date: v.dateText.simpleText,
            views: this._convert(v.viewCount.videoViewCountRenderer.viewCount.simpleText),
            likes: this._convert(v.videoActions?.menuRenderer?.topLevelButtons?.find((b: any) => b.segmentedLikeDislikeButtonViewModel)?.segmentedLikeDislikeButtonViewModel.likeButtonViewModel.likeButtonViewModel.toggleButtonViewModel.toggleButtonViewModel.toggledButtonViewModel.buttonViewModel.title || "0"),
            thumbnail: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
            tags: v.superTitleLink?.runs.map((t: any) => t.text).join(", ") || "",
            author: {
                name: a.title.runs[0].text,
                username: a.navigationEndpoint.browseEndpoint.canonicalBaseUrl.replace("/", ""),
                subscribers: this._convert(a.subscriberCountText.simpleText),
                thumbnail: a.thumbnail.thumbnails.at(-1).url,
                url: `https://www.youtube.com${a.navigationEndpoint.browseEndpoint.canonicalBaseUrl}`
            }
        };
    }

    async download_v1(url: string): Promise<DownloadResult> {
        const { data } = await this.client.post(`${this.baseUrl}/proxy.php`, new URLSearchParams({ url }), { headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" } });
        const api = data?.api;
        if (!api || api.status === "ERROR") throw new Error(api?.message || "API error");
        const items = api.mediaItems || [];
        const mapItem = async (i: any) => ({ quality: i.mediaQuality, res: i.mediaRes, size: i.mediaFileSize, format: i.mediaExtension, duration: i.mediaDuration, url: await this.pollUrl(i.mediaUrl) });
        const videos = await Promise.all(items.filter((i: any) => i.type?.toLowerCase() === "video").map(mapItem));
        const audios = await Promise.all(items.filter((i: any) => i.type?.toLowerCase() === "audio").map(mapItem));
        return {
            info: { id: api.id, title: api.title, desc: api.description, thumb: api.imagePreviewUrl, preview: api.previewUrl, link: api.permanentLink, service: api.service },
            channel: { name: api.userInfo?.name, user: api.userInfo?.username, id: api.userInfo?.userId, avatar: api.userInfo?.userAvatar, verified: api.userInfo?.isVerified || false, site: api.userInfo?.externalUrl, bio: api.userInfo?.userBio, category: api.userInfo?.userCategory, internal: api.userInfo?.internalUrl, country: api.userInfo?.accountCountry, joined: api.userInfo?.dateJoined },
            stats: { views: api.mediaStats?.viewsCount, vids: api.mediaStats?.mediaCount, subs: api.mediaStats?.followersCount, following: api.mediaStats?.followingCount, likes: api.mediaStats?.likesCount, comments: api.mediaStats?.commentsCount, favorites: api.mediaStats?.favouritesCount, shares: api.mediaStats?.sharesCount, downloads: api.mediaStats?.downloadsCount },
            videos: videos.filter(v => v.url), audios: audios.filter(a => a.url)
        };
    }

    async download_v2(url: string, opts: YtDlpOpts = {}): Promise<BufferResult> {
        if (!url) throw new Error("URL is required");
        const { video = false, title = "yt", cookiesPath = join(process.cwd(), "cookies.txt") } = opts;
        const ext = video ? "mp4" : "m4a";
        const outFile = join("/tmp", `yt_${Date.now()}.${ext}`);
        const args = ["--js-runtimes", "deno", "--remote-components", "ejs:npm", "--no-playlist", "-f", video ? "best[ext=mp4][height<=360]" : "bestaudio[ext=m4a]", "-o", outFile];
        if (existsSync(cookiesPath)) args.unshift("--cookies", cookiesPath);
        try {
            await execPromise(`yt-dlp ${args.map(a => `"${a}"`).join(" ")} "${url}"`, { maxBuffer: 300 * 1024 * 1024 });
            const buffer = readFileSync(outFile);
            return { buffer, mimetype: video ? "video/mp4" : "audio/x-m4a", fileName: `${(title || "yt").replace(/[\\/:*?"<>|]/g, "").slice(0, 60)}.${ext}` };
        } finally {
            try { unlinkSync(outFile); } catch { }
        }
    }
}