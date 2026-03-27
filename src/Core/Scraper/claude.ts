import axios from "axios";
import { v4 as uuid } from "uuid";
import fs from "fs";
import path from "path";
import FormData from "form-data";

interface ClaudeOptions { timezone?: string; locale?: string }

const COOKIES: { name: string; value: string }[] = [];
const COOKIE_STRING = COOKIES.map(c => `${c.name}=${c.value}`).join("; ");

const ORG_ID    = "mana_id_mu_men";
const MODEL     = "claude-sonnet-4-6";
const DEVICE_ID = "mana_device_id_mu_men";
const ANON_ID   = "mana_anoni_mu_men";
const MAX_IMAGES = 2;
const MAX_PROMPT = 2500;

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp" };

const BASE = {
    "accept": "*/*", "accept-encoding": "gzip, deflate, br", "accept-language": "en-US,en;q=0.9",
    "anthropic-anonymous-id": ANON_ID, "anthropic-client-platform": "web_claude_ai",
    "anthropic-client-sha": "456b13de6bf5c5013fd09fbfc657137b90de112a",
    "anthropic-client-version": "1.0.0", "anthropic-device-id": DEVICE_ID,
    "cache-control": "no-cache", "cookie": COOKIE_STRING, "origin": "https://claude.ai", "pragma": "no-cache",
    "sec-ch-ua": '"Chromium";v="137", "Not/A)Brand";v="24"', "sec-ch-ua-mobile": "?1", "sec-ch-ua-platform": '"Android"',
    "sec-fetch-dest": "empty", "sec-fetch-mode": "cors", "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
};

async function createConv(): Promise<string> {
    const convId = uuid();
    const res = await axios.post(`https://claude.ai/api/organizations/${ORG_ID}/chat_conversations`,
        { uuid: convId, name: "", enabled_imagine: true, include_conversation_preferences: true, is_temporary: false },
        { headers: { ...BASE, "content-type": "application/json", "referer": "https://claude.ai/new" }, decompress: true }
    );
    return res.data.uuid;
}

async function upload(convId: string, filePath: string): Promise<string> {
    const form = new FormData();
    const name = path.basename(filePath);
    form.append("file", fs.readFileSync(filePath), { filename: name, contentType: MIME[path.extname(name).toLowerCase()] ?? "application/octet-stream" });
    const res = await axios.post(
        `https://claude.ai/api/organizations/${ORG_ID}/conversations/${convId}/wiggle/upload-file`, form,
        { headers: { ...BASE, ...form.getHeaders(), "referer": "https://claude.ai/new" }, decompress: true, maxContentLength: Infinity, maxBodyLength: Infinity }
    );
    return res.data.file_uuid;
}

async function send(convId: string, prompt: string, files: string[], opts: ClaudeOptions): Promise<string> {
    const res = await axios.post(
        `https://claude.ai/api/organizations/${ORG_ID}/chat_conversations/${convId}/completion`,
        {
            prompt, files, model: MODEL, attachments: [], sync_sources: [], tools: [], rendering_mode: "messages",
            timezone: opts.timezone ?? "Asia/Makassar", locale: opts.locale ?? "en-US",
            personalized_styles: [{ isDefault: true, key: "Default", name: "Normal", nameKey: "normal_style_name", prompt: "Normal\n", summary: "Default responses from Claude", summaryKey: "normal_style_summary", type: "default" }],
            turn_message_uuids: { human_message_uuid: uuid(), assistant_message_uuid: uuid() },
        },
        { headers: { ...BASE, "accept": "text/event-stream", "content-type": "application/json", "referer": `https://claude.ai/chat/${convId}` }, responseType: "stream", decompress: true }
    );

    return new Promise((resolve, reject) => {
        let text = "", buf = "";
        res.data.on("data", (chunk: Buffer) => {
            buf += chunk.toString();
            const lines = buf.split("\n");
            buf = lines.pop()!;
            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const raw = line.slice(6).trim();
                if (!raw || raw === "[DONE]") continue;
                try {
                    const e = JSON.parse(raw);
                    if (e.type === "content_block_delta" && e.delta?.type === "text_delta") {
                        text += e.delta.text;
                        process.stdout.write(e.delta.text);
                    }
                } catch {}
            }
        });
        res.data.on("end", () => { console.log(); resolve(text); });
        res.data.on("error", reject);
    });
}

export async function claude(query: string, imagePaths: string[] = [], opts: ClaudeOptions = {}): Promise<string> {
    if (query.length > MAX_PROMPT)   throw new Error(`Prompt exceeds ${MAX_PROMPT} chars (${query.length})`);
    if (imagePaths.length > MAX_IMAGES) throw new Error(`Max ${MAX_IMAGES} images, got ${imagePaths.length}`);

    const convId   = await createConv();
    const fileUuids = await Promise.all(imagePaths.map(p => upload(convId, p)));
    return send(convId, query, fileUuids, opts);
}
