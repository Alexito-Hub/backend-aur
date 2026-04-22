import axios from "axios";

interface Base {
    url: string;
    author: string;
    title: string;
    creation: string | null;
    stats?: {
        views?: number;
        reactions?: number;
    };
}
interface Video extends Base { type: "video"; download: string; thumbnail: string | null; duration: number }
interface Image extends Base { type: "image"; download: string }
interface Album extends Base { type: "album"; images: string[]; videos?: string[] }
export type FBResult = Video | Image | Album;

interface FBStalkResult {
    type: "profile" | "content";
    name: string;
    url: string;
    username: string | null;
    bio: string | null;
    image: string | null;
    followers: number | null;
    likes?: number | null;
    talkingAbout?: number | null;
    verified?: boolean;
    category?: string | null;
    contentType?: FBResult["type"];
    stats?: Base["stats"];
}

export default new class Facebook {
    private readonly headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "sec-fetch-mode": "navigate",
        "upgrade-insecure-requests": "1",
    };

    public pick(o: any, k: string): any {
        if (!o || typeof o !== "object") return;
        if (k in o) return o[k];
        for (const v of Object.values(o)) {
            const r = this.pick(v, k);
            if (r !== undefined) return r;
        }
    }

    async stalk(input: string): Promise<FBStalkResult> {
        const raw = input?.trim();
        if (!raw) throw new Error("Profile URL or username is required");
        const url = /^https?:\/\//i.test(raw) ? raw : `https://facebook.com/${raw.replace(/^@/, "")}`;

        const isPostLike = /facebook\.com\/(share|reel|watch|videos|[^/]+\/posts)\//i.test(url);
        if (isPostLike) {
            const x = await this.download(url);
            const profile = (x.author ?? "").trim();
            return {
                type: "content",
                name: profile || "Facebook User",
                url,
                username: null,
                bio: x.title ?? null,
                image: x.type === "video" ? x.thumbnail : x.type === "image" ? x.download : x.images?.[0] ?? null,
                followers: x.stats?.views ?? null,
                likes: x.stats?.reactions ?? null,
                contentType: x.type,
                stats: x.stats,
            };
        }

        const { data } = await axios.get<string>(url, { headers: this.headers, timeout: 15_000 });
        const html = String(data).replace(/&quot;/g, '"').replace(/&amp;/g, "&");

        const og = (k: string) => html.match(new RegExp(`(?:property|name)="${k}"\\s+content="([^"]+)"`))?.[1] ?? null;
        const t = (v: string | null | undefined) => (v ?? "").replace(/&#\d+;|&#x[\da-f]+;|&nbsp;|&amp;|&quot;/gi, " ").replace(/\s+/g, " ").trim();
        const n = (rawText: string): number | null => {
            const s = t(rawText).toLowerCase();
            const m = s.match(/([\d.,]+)\s*(k|m|mil)?/i);
            if (!m) return null;
            const v = parseFloat((m[1] ?? "").replace(/,/g, "."));
            if (Number.isNaN(v)) return null;
            const u = m[2]?.toLowerCase();
            if (u === "m") return Math.round(v * 1_000_000);
            if (u === "k" || u === "mil") return Math.round(v * 1_000);
            return Math.round(v);
        };

        const name = t(og("og:title")) || "Facebook User";
        const bio = t(og("og:description")) || null;
        const image = og("og:image") ?? null;
        const profileUrl = og("og:url") ?? url;
        const username = profileUrl.match(/facebook\.com\/([^/?#]+)/i)?.[1] ?? null;

        const followers = (() => {
            const src = [bio ?? "", html.slice(0, 250_000)].join(" ");
            const m = src.match(/([\d.,]+\s*(?:k|m|mil)?)\s*(?:followers?|seguidores)/i);
            return m ? n(m[1]) : null;
        })();

        const likes = (() => {
            const src = [bio ?? "", html.slice(0, 250_000)].join(" ");
            const m = src.match(/([\d.,]+\s*(?:k|m|mil)?)\s*(?:likes?|me gusta)/i);
            return m ? n(m[1]) : null;
        })();

        const talkingAbout = (() => {
            const src = html.slice(0, 250_000);
            const m = src.match(/([\d.,]+\s*(?:k|m|mil)?)\s*(?:talking about this|personas están hablando de esto)/i);
            return m ? n(m[1]) : null;
        })();

        const verified = /is_verified"?\s*:\s*true|verified account|badge/i.test(html);
        const category = (() => {
            const src = [bio ?? "", html.slice(0, 120_000)].join(" ");
            const m = src.match(/(?:likes?\s*\d+[\d\s.,kKmM]*\s*\d*\s*talking about this\.?\s*)([A-Za-zÁÉÍÓÚáéíóúÑñ\s&\-]{3,50})/i);
            return m?.[1]?.trim() || null;
        })();

        return {
            type: "profile",
            name,
            url: profileUrl,
            username,
            bio,
            image,
            followers,
            likes,
            talkingAbout,
            verified,
            category,
        };
    }

    async download(url: string): Promise<FBResult> {
        if (!url?.trim() || !/facebook\.com|fb\.watch/.test(url)) throw new Error("Invalid Facebook URL");

        const { data } = await axios.get<string>(url, { headers: this.headers, timeout: 15_000 });
        const html = data.replace(/&quot;/g, '"').replace(/&amp;/g, "&");

        const t = (v: string | null | undefined): string => {
            if (!v) return "";
            return v
                .replace(/&#\d+;|&#x[\da-f]+;|&nbsp;|&amp;|&quot;/gi, " ")
                .replace(/\s+/g, " ")
                .trim();
        };

        const m = (value: string): boolean => {
            return /(views?|reactions?|reproducciones?|visualizaciones?|comentarios?|likes?)\b/i.test(value)
                || /\b\d+[\d\s.,]*\b/.test(value) && /\b(k|m|mil)\b/i.test(value);
        };

        const n = (raw: string): number | null => {
            const text = t(raw).toLowerCase();
            const m = text.match(/([\d.,]+)\s*(k|m|mil)?/i);
            if (!m) return null;
            const value = parseFloat((m[1] ?? "").replace(/,/g, "."));
            if (Number.isNaN(value)) return null;
            const unit = m[2]?.toLowerCase();
            if (unit === "m") return Math.round(value * 1_000_000);
            if (unit === "k" || unit === "mil") return Math.round(value * 1_000);
            return Math.round(value);
        };

        const blobs: any[] = [];
        for (const [, s] of html.matchAll(/<script[^>]*>(\{.+?})<\/script>/gs)) {
            try { 
                blobs.push(JSON.parse(s));
            } catch {}
        }

        const g = (k: string) => blobs.reduce((v: any, b) => v ?? this.pick(b, k), undefined);
        const d = (s: string) => { try { return JSON.parse(`"${s}"`); } catch { return s; } };
        const o = (k: string) => html.match(new RegExp(`(?:property|name)="${k}"\\s+content="([^"]+)"`))?.[1] ?? null;

        const ot = o("og:title");
        const parts = t(ot).split("|").map(x => t(x)).filter(Boolean);
        let ogAuthor = "";
        for (let i = parts.length - 1; i >= 0; i--) {
            const c = parts[i];
            if (c && !m(c) && c.length <= 80) { ogAuthor = c; break; }
        }
        const clean = (v: any) => {
            const c = t(v).split(" posted a ")[0].split(" publicó ")[0].split(" compartió ")[0].trim();
            return c && !m(c) ? c : "";
        };
        const author = [
            clean(this.pick(g("actors")?.[0], "name")),
            clean(this.pick(g("owner"), "name")),
            clean(this.pick(g("owning_profile"), "name")),
            clean(this.pick(g("video_owner"), "name")),
            clean(ogAuthor),
        ].find(Boolean) || "Facebook User";

        const stats = (() => {
            const s = t(ot);
            const fromOg = (() => {
                if (!s) return { views: null as number | null, reactions: null as number | null };
                const vm = s.match(/([\d.,]+\s*(?:k|m|mil)?)\s*(?:views?|reproducciones?|visualizaciones?)/i);
                const rm = s.match(/([\d.,]+\s*(?:k|m|mil)?)\s*(?:reactions?|reacciones?)/i);
                return {
                    views: vm ? n(vm[1]) : null,
                    reactions: rm ? n(rm[1]) : null,
                };
            })();

            const fromJsonViews = n(String(g("video_view_count") ?? g("view_count") ?? this.pick(g("feedback"), "video_view_count") ?? this.pick(g("feedback"), "view_count") ?? "" ));

            const fromJsonReactions = n(String(g("reaction_count") ?? g("i18n_reaction_count") ?? this.pick(g("feedback"), "reaction_count") ?? this.pick(g("feedback"), "i18n_reaction_count") ?? this.pick(g("feedback"), "reactors_count") ?? ""));
            const views = fromOg.views ?? fromJsonViews;

            const reactions = fromOg.reactions ?? fromJsonReactions;
            if (views == null && reactions == null) return undefined;
            return {
                ...(views != null ? { views } : {}),
                ...(reactions != null ? { reactions } : {}),
            };
        })();

        const msg = g("message");
        const title = (typeof msg === "object" ? msg?.text : msg) ?? o("og:description") ?? "Facebook Post";
        const ts = g("creation_time") ?? g("publish_time");
        const base: Base = {
            url, 
            author,
            title,
            creation: ts ? new Date(ts * 1000).toLocaleString() : null,
            ...(stats ? { stats } : {})
        };

        const nodes: any[] = g("all_subattachments")?.nodes ?? [];
        if (nodes.length) {
            const images = [...new Set(nodes.map(n => d(this.pick(n, "viewer_image")?.uri ?? this.pick(n, "image")?.uri ?? "")).filter(Boolean))] as string[];
            const videos = [...new Set(nodes.map(n => d(this.pick(n, "browser_native_hd_url") ?? this.pick(n, "playable_url_quality_hd") ?? this.pick(n, "browser_native_sd_url") ?? this.pick(n, "playable_url") ?? "")).filter(Boolean))] as string[];
            if (images.length || videos.length) return {
                ...base,
                type: "album",
                images,
                ...(videos.length ? { videos } : {})
            };
        }

        const videoUrl = g("browser_native_hd_url") ?? g("playable_url_quality_hd") ?? g("browser_native_sd_url") ?? g("playable_url");
        if (videoUrl) return {
            ...base,
            type: "video",
            download: d(videoUrl),
            thumbnail: d(this.pick(g("preferred_thumbnail"), "uri") ?? "") || o("og:image"),
            duration: g("playable_duration_in_ms") ?? 0,
        };

        const imgUri = d(this.pick(g("photo_image"), "uri") ?? this.pick(g("image"), "uri") ?? "") || o("og:image");
        if (imgUri) return {
            ...base,
            type: "image",
            download: imgUri
        };

        throw new Error("Content not found (private or deleted)");
    }
}