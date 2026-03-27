import https from "https";
import fs from "fs";
import crypto from "crypto";

const PUB_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCwlO+boC6cwRo3UfXVBadaYwcX
0zKS2fuVNY2qZ0dgwb1NJ+/Q9FeAosL4ONiosD71on3PVYqRUlL5045mvH2K9i8b
AFVMEip7E6RMK6tKAAif7xzZrXnP1GZ5Rijtqdgwh+YmzTo39cuBCsZqK9oEoeQ3
r/myG9S+9cR5huTuFQIDAQAB
-----END PUBLIC KEY-----`;

function sign(type: string, fp: string) {
    const ts  = Math.floor(Date.now() / 1000);
    const uid = crypto.randomUUID();
    const key = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        .split("").sort(() => Math.random() - .5).slice(0, 16).join("");
    const enc = crypto.publicEncrypt({ key: PUB_KEY, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(key)).toString("base64");
    const aes = (d: string) => {
        const k = Buffer.from(key, "utf8");
        const c = crypto.createCipheriv("aes-128-cbc", k, k);
        return Buffer.concat([c.update(d, "utf8"), c.final()]).toString("base64");
    };
    const str = type === "upload" ? `aifaceswap:${uid}:${enc}` : `aifaceswap:1H5tRtzsBkqXcaJ:${ts}:${uid}:${enc}`;
    return { fp, "fp1": aes(`aifaceswap:${fp}`), "x-guide": enc, "x-sign": aes(str), "x-code": Date.now().toString() };
}

function post(url: string, body: Buffer | object, headers: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
        const u   = new URL(url);
        const buf = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
        const req = https.request({
            hostname: u.hostname, path: u.pathname, method: "POST",
            headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
                "Accept": "application/json, text/plain, */*",
                "Origin": "https://live3d.io", "Referer": "https://live3d.io/",
                "theme-version": "83EmcUoQTUv50LhNx0VrdcK8rcGexcP35FcZDcpgWsAXEyO4xqL5shCY6sFIWB2Q",
                "Content-Length": buf.length, ...headers,
            },
        }, res => {
            const c: Buffer[] = [];
            res.on("data", d => c.push(d));
            res.on("end", () => { try { resolve(JSON.parse(Buffer.concat(c).toString())); } catch { resolve(Buffer.concat(c).toString()); } });
        });
        req.on("error", reject); req.write(buf); req.end();
    });
}

export async function colorize(imgPath: string): Promise<string> {
    const fp   = crypto.randomBytes(16).toString("hex");
    const file = fs.readFileSync(imgPath);
    const name = imgPath.split(/[\\/]/).pop()!;
    const mime = name.endsWith(".png") ? "image/png" : "image/jpeg";
    const b    = "----LiveBound" + Date.now().toString(16);
    const body = Buffer.concat([
        Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${mime}\r\n\r\n`),
        file,
        Buffer.from(`\r\n--${b}\r\nContent-Disposition: form-data; name="fn_name"\r\n\r\ndemo-auto-coloring\r\n--${b}\r\nContent-Disposition: form-data; name="request_from"\r\n\r\n9\r\n--${b}\r\nContent-Disposition: form-data; name="origin_from"\r\n\r\n8f3f0c7387123ae0\r\n--${b}--\r\n`),
    ]);

    const up = await post("https://app.live3d.io/aitools/upload-img", body, { "Content-Type": `multipart/form-data; boundary=${b}`, ...sign("upload", fp) });
    if (!up?.data?.path) throw new Error("Upload failed: " + JSON.stringify(up));

    const cr = await post("https://app.live3d.io/aitools/of/create", {
        fn_name: "demo-auto-coloring", call_type: 3, data: "",
        input: { source_image: up.data.path, lora: [], prompt: "(masterpiece), best quality", request_from: 9 },
        origin_from: "8f3f0c7387123ae0", request_from: 9,
    }, { "Content-Type": "application/json", ...sign("create", fp) });
    if (!cr?.data?.task_id) throw new Error("Create failed: " + JSON.stringify(cr));

    let st: any;
    do {
        await new Promise(r => setTimeout(r, 3000));
        st = await post("https://app.live3d.io/aitools/of/check-status", {
            task_id: cr.data.task_id, fn_name: "demo-auto-coloring",
            call_type: 3, origin_from: "8f3f0c7387123ae0", request_from: 9,
        }, { "Content-Type": "application/json", ...sign("check", fp) });
    } while (st?.data?.status !== 2);

    const out = imgPath.replace(/(\.[^.]+)$/, "_colored$1");
    await new Promise<void>((resolve, reject) => {
        const dl = (url: string) => https.get(url, res =>
            res.statusCode === 301 || res.statusCode === 302
                ? dl(res.headers.location!)
                : res.pipe(fs.createWriteStream(out)).on("finish", resolve)
        ).on("error", reject);
        dl("https://temp.live3d.io/" + st.data.result_image);
    });

    return out;
}
