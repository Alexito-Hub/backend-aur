import https from "https";
import crypto from "crypto";
import fs from "fs";
import path from "path";

export default new class DeepAI {
    private post(p: string, fields: Record<string, string>, file?: { name: string; buffer: Buffer; mime: string }): Promise<string> {
        return new Promise((resolve, reject) => {
            const b     = "----" + crypto.randomBytes(16).toString("hex");
            const parts = Object.entries(fields).map(([k, v]) => `--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}`).join("\r\n");
            const body  = file
                ? Buffer.concat([Buffer.from(parts + `\r\n--${b}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.mime}\r\n\r\n`), file.buffer, Buffer.from(`\r\n--${b}--`)])
                : Buffer.from(parts + `\r\n--${b}--`);

            const req = https.request({
                hostname: "api.deepai.org", path: p, method: "POST",
                headers: { "api-key": "tryit-46250764014-3e32c7cea5e2c93bdfd535d9f80155c7", "Content-Type": `multipart/form-data; boundary=${b}`, "Content-Length": body.length },
            }, res => { let d = ""; res.on("data", c => d += c); res.on("end", () => resolve(d)); });
            req.on("error", reject); req.write(body); req.end();
        });
    }

    async chat(query: string, imagePath?: string): Promise<{ ai_msg: string }> {
        const session = crypto.randomUUID();
        let attachments: string[] = [];

        if (imagePath) {
            const buf  = fs.readFileSync(imagePath);
            const name = path.basename(imagePath);
            const up   = await this.post("/chat_attachments/upload", {}, { name, buffer: buf, mime: "image/jpeg" });
            attachments = [JSON.parse(up).attachment.uuid];
        }

        const msg: any = { role: "user", content: query };
        if (attachments.length) msg.attachment_uuids = attachments;
        const history = JSON.stringify([msg]);

        await this.post("/save_chat_session", { uuid: session, title: "", chat_style: "chat", messages: history });

        const fields: Record<string, string> = {
            chat_style: "chat", chatHistory: history, model: "standard",
            session_uuid: session, sensitivity_request_id: crypto.randomUUID(),
            hacker_is_stinky: "very_stinky",
            enabled_tools: JSON.stringify(["image_generator", "image_editor"]),
        };
        if (attachments.length) fields.attachment_uuids = JSON.stringify(attachments);

        return { ai_msg: await this.post("/hacking_is_a_serious_crime", fields) };
    }
}

