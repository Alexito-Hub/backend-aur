import https from "https";
import fs from "fs";
import path from "path";

interface Res { status: number; headers: Record<string, any>; body: string }

function req(options: https.RequestOptions, body: string | Buffer | null = null): Promise<Res> {
    return new Promise((resolve, reject) => {
        const r = https.request(options, res => {
            const c: Buffer[] = [];
            res.on("data", d => c.push(d));
            res.on("end", () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(c).toString() }));
        });
        r.on("error", reject);
        if (body) r.write(body);
        r.end();
    });
}

const TM = { "Content-Type": "application/json", "Application-Name": "web", "Application-Version": "4.0.0", "X-CORS-Header": "iaWg3pchvFx48fY" };
const cookies = (res: Res) => (res.headers["set-cookie"] ?? []).map((c: string) => c.split(";")[0]).join("; ");

export async function nanobana(input: { imagePath: string; prompt: string }): Promise<any> {
    const { imagePath, prompt } = input;

    const tmRes  = await req({ hostname: "api.internal.temp-mail.io", path: "/api/v3/email/new", method: "POST", headers: TM }, JSON.stringify({ min_name_length: 10, max_name_length: 10 }));
    const { email, token } = JSON.parse(tmRes.body);

    await req({ hostname: "www.nanobana.net", path: "/api/auth/email/send", method: "POST", headers: { "Content-Type": "application/json" } }, JSON.stringify({ email }));

    let code: string | null = null;
    for (let i = 0; i < 15 && !code; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const inbox = await req({ hostname: "api.internal.temp-mail.io", path: `/api/v3/email/${email}/messages`, method: "GET", headers: { ...TM, "X-Mail-Token": token } });
        const msgs  = JSON.parse(inbox.body);
        if (msgs.length) code = msgs[0].subject.match(/\d{6}/)?.[0] ?? null;
    }
    if (!code) throw new Error("Code not received");

    const csrfRes  = await req({ hostname: "www.nanobana.net", path: "/api/auth/csrf", method: "GET", headers: { "Content-Type": "application/json" } });
    const { csrfToken } = JSON.parse(csrfRes.body);
    const payload  = new URLSearchParams({ email, code, redirect: "false", csrfToken, callbackUrl: "https://www.nanobana.net/" }).toString();
    const loginRes = await req({
        hostname: "www.nanobana.net", path: "/api/auth/callback/email-code?", method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(payload), "Cookie": cookies(csrfRes), "Origin": "https://www.nanobana.net", "Referer": "https://www.nanobana.net/", "X-Auth-Return-Redirect": "1" },
    }, payload);
    const session = cookies(loginRes);

    const file = fs.readFileSync(imagePath);
    const name = path.basename(imagePath);
    const mime = [".jpg", ".jpeg"].includes(path.extname(name).toLowerCase()) ? "image/jpeg" : "image/png";
    const b    = "----WebKitFormBoundary" + Math.random().toString(36).slice(2);
    const mp   = Buffer.concat([Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${mime}\r\n\r\n`), file, Buffer.from(`\r\n--${b}--\r\n`)]);

    const upRes = await req({
        hostname: "www.nanobana.net", path: "/api/upload/image", method: "POST",
        headers: { "Content-Type": `multipart/form-data; boundary=${b}`, "Content-Length": mp.length, "Cookie": session, "Origin": "https://www.nanobana.net", "Referer": "https://www.nanobana.net/", "X-Original-Size": file.length },
    }, mp);
    const { url: imgUrl } = JSON.parse(upRes.body);

    const genBody = JSON.stringify({ prompt, aspect_ratio: "1:1", image_input: [imgUrl], output_format: "png", resolution: "1K" });
    const genRes  = await req({
        hostname: "www.nanobana.net", path: "/api/nano-banana-pro/generate", method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(genBody), "Cookie": session, "Origin": "https://www.nanobana.net", "Referer": "https://www.nanobana.net/" },
    }, genBody);
    const { data: { taskId } } = JSON.parse(genRes.body);

    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const r = await req({
            hostname: "www.nanobana.net", path: `/api/nano-banana-pro/task/${taskId}?save=1&prompt=${encodeURIComponent(prompt)}`, method: "GET",
            headers: { "Content-Type": "application/json", "Cookie": session, "Referer": "https://www.nanobana.net/" },
        });
        const data = JSON.parse(r.body);
        if (data.data?.status === "completed") return data;
    }

    return null;
}
