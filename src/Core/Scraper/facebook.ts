import axios from "axios";

interface Base { url: string; author: string; title: string; creation: string | null }
interface Video extends Base { type: "video"; download: string; thumbnail: string | null; duration: number }
interface Image extends Base { type: "image"; download: string }
interface Album extends Base { type: "album"; images: string[] }
export type FBResult = Video | Image | Album;

export default class Facebook {
    private readonly headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "sec-fetch-mode": "navigate",
        "upgrade-insecure-requests": "1",
    };

    private pick(o: any, k: string): any {
        if (!o || typeof o !== "object") return;
        if (k in o) return o[k];
        for (const v of Object.values(o)) { const r = this.pick(v, k); if (r !== undefined) return r; }
    }

    async download(url: string): Promise<FBResult> {
        if (!url?.trim() || !/facebook\.com|fb\.watch/.test(url)) throw new Error("Invalid Facebook URL");

        const { data } = await axios.get<string>(url, { headers: this.headers, timeout: 15_000 });
        const html = data.replace(/&quot;/g, '"').replace(/&amp;/g, "&");

        const blobs: any[] = [];
        for (const [, s] of html.matchAll(/<script[^>]*>(\{.+?})<\/script>/gs))
            try { blobs.push(JSON.parse(s)); } catch {}

        const get  = (k: string) => blobs.reduce((v: any, b) => v ?? this.pick(b, k), undefined);
        const dec  = (s: string) => { try { return JSON.parse(`"${s}"`); } catch { return s; } };
        const og   = (p: string) => html.match(new RegExp(`(?:property|name)="${p}"\\s+content="([^"]+)"`))?.[1] ?? null;

        const rawAuthor = this.pick(get("owner"), "name") ?? this.pick(get("owning_profile"), "name") ?? this.pick(get("actors")?.[0], "name") ?? og("og:title") ?? "Facebook User";
        const author = rawAuthor.replace(/&#\w+;/g, "").split(" | ")[0].split(" posted a ")[0].trim() || "Facebook User";

        const msg = get("message");
        const title = (typeof msg === "object" ? msg?.text : msg) ?? og("og:description") ?? "Facebook Post";
        const ts = get("creation_time") ?? get("publish_time");
        const base: Base = {
            url, 
            author,
            title,
            creation: ts ? new Date(ts * 1000).toLocaleString() : null
        };

        const nodes: any[] = get("all_subattachments")?.nodes ?? [];
        if (nodes.length) {
            const images = [...new Set(nodes.map(n => dec(this.pick(n, "viewer_image")?.uri ?? this.pick(n, "image")?.uri ?? "")).filter(Boolean))] as string[];
            if (images.length) return {
                ...base,
                type: "album",
                images
            };
        }

        const videoUrl = get("browser_native_hd_url") ?? get("playable_url_quality_hd")
            ?? get("browser_native_sd_url") ?? get("playable_url");
        if (videoUrl) return {
            ...base,
            type: "video",
            download: dec(videoUrl),
            thumbnail: dec(this.pick(get("preferred_thumbnail"), "uri") ?? "") || og("og:image"),
            duration: get("playable_duration_in_ms") ?? 0,
        };

        const imgUri = dec(this.pick(get("photo_image"), "uri") ?? this.pick(get("image"), "uri") ?? "") || og("og:image");
        if (imgUri) return {
            ...base,
            type: "image",
            download: imgUri
        };

        throw new Error("Content not found (private or deleted)");
    }
}