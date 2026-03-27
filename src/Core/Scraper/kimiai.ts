import https from "https";
import zlib from "zlib";

interface Cookie { name: string; value: string }
interface KimiOptions { timezone?: string; language?: string }
interface KimiResult { chatId: string | null; text: string; frames: any[] }

export default new class KimiAI {
    private readonly COOKIES: Cookie[] = [];
    private readonly TOKEN = this.COOKIES.find(c => c.name === "kimi-auth")?.value || "";
    private readonly COOKIE_STR = this.COOKIES.map(c => `${c.name}=${c.value}`).join("; ");

    private baseHeaders(opts: KimiOptions = {}): Record<string, string> {
        return {
            "Authorization": `Bearer ${this.TOKEN}`,
            "Cookie": this.COOKIE_STR,
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
            "Accept-Language": opts.language ?? "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Origin": "https://www.kimi.com",
            "Referer": "https://www.kimi.com/",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "R-Timezone": opts.timezone ?? "Asia/Makassar",
            "X-Language": opts.language?.split(",")[0].trim() ?? "en-US",
            "X-Traffic-Id": "d2dbe15eik6joqg7ircg",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        };
    }

    private encodeFrame(obj: object): Buffer {
        const body = Buffer.from(JSON.stringify(obj), "utf8");
        const frame = Buffer.alloc(5 + body.length);
        frame[0] = 0x00;
        frame.writeUInt32BE(body.length, 1);
        body.copy(frame, 5);
        return frame;
    }

    private decodeFrames(buf: Buffer): any[] {
        const out: any[] = [];
        let offset = 0;
        while (offset + 5 <= buf.length) {
            const len = buf.readUInt32BE(offset + 1);
            offset += 5;
            if (offset + len > buf.length) break;
            try { out.push(JSON.parse(buf.slice(offset, offset + len).toString("utf8"))); } catch {}
            offset += len;
        }
        return out;
    }

    private decompress(buf: Buffer, enc?: string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            if (enc === "gzip")    return zlib.gunzip(buf, (e, r) => e ? reject(e) : resolve(r));
            if (enc === "deflate") return zlib.inflate(buf, (e, r) => e ? reject(e) : resolve(r));
            if (enc === "br")      return zlib.brotliDecompress(buf, (e, r) => e ? reject(e) : resolve(r));
            resolve(buf);
        });
    }

    private post(p: string, body: Buffer, headers: Record<string, any>): Promise<{ status: number; headers: Record<string, any>; body: Buffer }> {
        return new Promise((resolve, reject) => {
            const req = https.request({ hostname: "www.kimi.com", port: 443, path: p, method: "POST", headers: { ...headers, "Content-Length": String(body.length) } }, res => {
                const c: Buffer[] = [];
                res.on("data", d => c.push(d));
                res.on("end", async () => {
                    try { resolve({ status: res.statusCode!, headers: res.headers, body: await this.decompress(Buffer.concat(c), res.headers["content-encoding"] as string) }); }
                    catch (e) { reject(e); }
                });
            });
            req.on("error", reject); req.write(body); req.end();
        });
    }

    async chat(query: string, chatId: string | null = null, opts: KimiOptions = {}): Promise<KimiResult> {
        const payload: any = {
            scenario: "SCENARIO_K2D5",
            tools: [{ type: "TOOL_TYPE_SEARCH", search: {} }],
            message: { role: "user", blocks: [{ message_id: "", text: { content: query } }] },
            options: { thinking: false },
        };
        if (chatId) payload.chat_id = chatId;

        const res = await this.post("/apiv2/kimi.gateway.chat.v1.ChatService/Chat", this.encodeFrame(payload), { ...this.baseHeaders(opts), "Content-Type": "application/connect+json", "Accept": "*/*" });
        if (res.status !== 200) throw new Error(`HTTP ${res.status}: ${res.body.toString()}`);

        const frames = this.decodeFrames(res.body);
        let text = "", newChatId = chatId;

        for (const f of frames) {
            if (f.chat?.id) newChatId = f.chat.id;
            if (f.op === "set" && f.mask === "block.exception") throw new Error(`Kimi exception: ${JSON.stringify(f.block?.exception)}`);
            if (f.op === "set"    && f.mask === "block.text")         text  = f.block?.text?.content ?? text;
            if (f.op === "append" && f.mask === "block.text.content") text += f.block?.text?.content ?? "";
        }

        return { chatId: newChatId, text, frames };
    }

    async listChats(pageSize = 5, query = "", opts: KimiOptions = {}): Promise<any> {
        const body = Buffer.from(JSON.stringify({ project_id: "", page_size: pageSize, query }), "utf8");
        const res  = await this.post("/apiv2/kimi.chat.v1.ChatService/ListChats", body, { ...this.baseHeaders(opts), "Content-Type": "application/json", "Accept": "*/*" });
        if (res.status !== 200) throw new Error(`HTTP ${res.status}: ${res.body.toString()}`);
        return JSON.parse(res.body.toString("utf8"));
    }
}

