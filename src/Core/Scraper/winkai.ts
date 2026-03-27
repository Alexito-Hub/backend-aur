import axios, { AxiosInstance } from "axios";
import FormData from "form-data";
import fs from "fs-extra";
import path from "path";
import qs from "qs";
import { v4 as uuid } from "uuid";

const API    = { BASE: "https://wink.ai", STRATEGY: "https://strategy.app.meitudata.com", QINIU: "https://up-qagw.meitudata.com" };
const CLIENT = { ID: "1189857605", VERSION: "3.7.1", LANGUAGE: "en_US" };

const TYPE_PARAMS  = { is_mirror: 0, orientation_tag: 1, j_420_trans: "1", return_ext: "2" };
const RIGHT_DETAIL = { source: "4", touch_type: "4", function_id: "630", material_id: "63001" };
const VALID_EXT    = [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"];

export const TASK = {
    HD:       { type: 2,  label: "HD Image",      content_type: 1, beans: 2, free: true },
    ULTRA_HD: { type: 12, label: "Ultra HD Image", content_type: 1, beans: 4, free: true },
} as const;

type TaskCfg = typeof TASK[keyof typeof TASK];

interface WinkOpts { outputDir?: string; country?: string; timezone?: string; language?: string }

function gnumLoad(): string {
    const f = path.join(process.cwd(), ".wink_gnum");
    if (fs.existsSync(f)) return fs.readFileSync(f, "utf8").trim();
    const ts = Date.now().toString(16);
    const r1 = Math.random().toString(16).slice(2).padEnd(12, "0").slice(0, 12);
    const r2 = Math.random().toString(16).slice(2).padEnd(12, "0").slice(0, 12);
    const g  = `${ts}-${r1}-10462c6e-288000-${ts}${r2.slice(0, 3)}`;
    fs.writeFileSync(f, g);
    return g;
}

export default new class WinkClient {
    private readonly http: AxiosInstance;
    private readonly gnum: string;
    private readonly country: string;
    private readonly timezone: string;
    private readonly language: string;
    private readonly outputDir: string;
    private readonly timing: Record<string, { start: number; ms?: number }> = {};

    constructor(opts: WinkOpts = {}) {
        this.outputDir = opts.outputDir ?? "./_wink";
        this.country   = opts.country   ?? "ID";
        this.timezone  = opts.timezone  ?? "Asia/Jakarta";
        this.language  = opts.language  ?? CLIENT.LANGUAGE;
        this.gnum      = gnumLoad();
        fs.ensureDirSync(this.outputDir);

        this.http = axios.create({
            baseURL: API.BASE, timeout: 60_000,
            headers: { "Accept": "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9", "Accept-Encoding": "gzip, deflate, br", "Origin": API.BASE, "Referer": `${API.BASE}/`, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
        });

        this.http.interceptors.response.use(null, async (err: any) => {
            const cfg = err.config ?? {};
            cfg._retries = (cfg._retries ?? 0) + 1;
            const status = err.response?.status;
            if (cfg._retries <= 3 && (status >= 500 || !status)) {
                await new Promise(r => setTimeout(r, cfg._retries * 2000));
                return this.http(cfg);
            }
            return Promise.reject(err);
        });
    }

    private p(extra: Record<string, any> = {}) {
        return { client_id: CLIENT.ID, version: CLIENT.VERSION, country_code: this.country, gnum: this.gnum, client_language: this.language, client_channel_id: "", client_timezone: this.timezone, ...extra };
    }

    private t(k: string)  { this.timing[k] = { start: Date.now() }; }
    private te(k: string) { if (this.timing[k]) this.timing[k].ms = Date.now() - this.timing[k].start; }

    async init() {
        this.t("init");
        const [a, b, c] = await Promise.allSettled([
            this.http.get("/api/init.json",                           { params: this.p() }),
            this.http.get("/api/meitu_ai/task_type_config.json",      { params: this.p() }),
            this.http.get("/api/meitu_ai_task_group/get_config.json", { params: this.p() }),
        ]);
        const safe = (r: any) => r.status === "fulfilled" ? r.value.data?.data : null;
        this.te("init");
        return { platform: safe(a), task_types: safe(b) ?? [], task_group: safe(c) };
    }

    async uploadFile(filePath: string) {
        this.t("upload");
        if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
        const ext = path.extname(filePath).toLowerCase() || ".jpg";
        if (!VALID_EXT.includes(ext)) throw new Error(`Unsupported format: ${ext}`);

        const stat    = fs.statSync(filePath);
        const signRes = await this.http.get("/api/file/get_maat_sign.json", { params: this.p({ suffix: ext, type: "temp", count: 1 }) });
        const sign    = signRes.data?.data;
        if (!sign?.sig) throw new Error("Failed to get upload signature");

        const polRes = await axios.get(`${API.STRATEGY}/upload/policy`, {
            params: { app: sign.app ?? "wink", count: 1, sig: sign.sig, sigTime: sign.sig_time, sigVersion: sign.sig_version, suffix: ext, type: "temp" }, timeout: 15_000,
        });
        const qiniu = polRes.data?.[0]?.qiniu;
        if (!qiniu?.token) throw new Error("Failed to get Qiniu policy");

        const form = new FormData();
        form.append("token", qiniu.token);
        form.append("key", qiniu.key);
        form.append("file", fs.createReadStream(filePath), { filename: path.basename(filePath), contentType: `image/${ext.replace(".", "").replace("jpg", "jpeg")}` });
        const upRes = await axios.post(qiniu.url ?? API.QINIU, form, { headers: form.getHeaders(), timeout: 300_000, maxBodyLength: Infinity, maxContentLength: Infinity });
        if (!upRes.data?.url) throw new Error("Qiniu upload returned no URL");

        const metaRes = await this.http.post("/api/file/meta_info.json", qs.stringify({ ...this.p(), file_key: qiniu.key }), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        const meta    = metaRes.data?.data;

        this.te("upload");
        return { fileKey: qiniu.key, fileUrl: upRes.data.url, etag: upRes.data.etag, localPath: filePath, fileName: path.basename(filePath), localSize: stat.size, storage: { bucket: qiniu.bucket, key: qiniu.key, url: qiniu.url, ttl: qiniu.ttl }, sign: { sig: sign.sig, sig_time: sign.sig_time, sig_version: sign.sig_version }, meta: { width: meta?.width, height: meta?.height, format: meta?.format, fileSize: meta?.fileSize, colorModel: meta?.colorModel, frameNumber: meta?.frameNumber } };
    }

    async submitTask(upload: Awaited<ReturnType<WinkClient["uploadFile"]>>, taskCfg: TaskCfg) {
        this.t("submit");
        const item = { type: taskCfg.type, ext_value: "1", content_type: taskCfg.content_type, duration: 0, type_params: JSON.stringify(TYPE_PARAMS), right_detail: JSON.stringify(RIGHT_DETAIL) };
        const beansRes = await this.http.post("/api/subscribe/batch_calc_need_beans.json", qs.stringify({ ...this.p(), item_list: JSON.stringify([item]) }), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        const beans    = beansRes.data?.data ?? {};
        const taskName = `${taskCfg.label.replace(/\s+/g, "_")}-${uuid().replace(/-/g, "").slice(0, 16)}`;

        const res = await this.http.post("/api/meitu_ai/delivery.json", qs.stringify({ ...this.p(), type: taskCfg.type, source_url: upload.fileUrl, content_type: taskCfg.content_type, ext_params: JSON.stringify({ task_name: taskName, records: "2" }), type_params: JSON.stringify(TYPE_PARAMS), right_detail: JSON.stringify(RIGHT_DETAIL), with_prepare: 1 }), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        const delivery = res.data?.data;
        if (!delivery?.prepare_msg_id) throw new Error("No prepare_msg_id from delivery");

        this.te("submit");
        return { prepareMsgId: delivery.prepare_msg_id, predictElapsed: delivery.predict_elapsed, taskName, taskCfg, beans: { required: beans.beans_not_vip_without_free, requiredVip: beans.beans_vip_without_free, isFree: beans.free_type === 1, freeType: beans.free_type, freeId: beans.beans_detail?.[0]?.free_id, freeNum: beans.func_free_detail?.[0]?.free_num, usedNum: beans.func_free_detail?.[0]?.use_num, totalNum: beans.func_free_detail?.[0]?.total_num } };
    }

    async waitForResult(task: Awaited<ReturnType<WinkClient["submitTask"]>>, pollMs = 2000, timeoutMs = 300_000) {
        this.t("poll");
        const deadline = Date.now() + timeoutMs;
        let msgId = task.prepareMsgId, attempt = 0;
        const log: any[] = [];

        while (Date.now() < deadline) {
            attempt++;
            await new Promise(r => setTimeout(r, attempt === 1 ? 800 : pollMs));

            let res: any;
            try { res = await this.http.get("/api/meitu_ai/query_batch.json", { params: { ...this.p(), msg_ids: msgId } }); }
            catch { continue; }

            const item    = res.data?.data?.item_list?.[0];
            const elapsed = Date.now() - this.timing.poll.start;
            if (!item) { log.push({ attempt, state: "empty", elapsed }); continue; }

            if (msgId.startsWith("wpr_")) {
                const realId = item.result?.result;
                if (realId && realId !== msgId) { log.push({ attempt, state: "prepare_resolved", prepareMsgId: msgId, realMsgId: realId, elapsed }); msgId = realId; }
                else log.push({ attempt, state: "prepare_pending", elapsed });
                continue;
            }

            const errCode = item.result?.error_code;
            if (errCode && errCode !== 0) { this.te("poll"); throw Object.assign(new Error(`AI error [${errCode}]: ${item.result?.error_msg}`), { errCode, pollLog: log }); }

            const media = item.result?.media_info_list;
            if (media?.length && media[0].media_data) {
                log.push({ attempt, state: "done", elapsed });
                this.te("poll");
                return { msgId, taskName: item.task_name, typeName: item.type_name, pollLog: log, media: { url: media[0].media_data, thumbUrl: media[0].thumb_pic, coverUrl: media[0].cover_pic, width: item.width, height: item.height, oriWidth: item.ori_width, oriHeight: item.ori_height, size: item.size, sizeHuman: item.size_human }, performance: { algoMs: item.result?.duration?.alg_process_time, waitMs: item.result?.duration?.waiting_time, uploadMs: item.result?.duration?.upload_time, predictMs: item.predict_elapsed, totalPollMs: elapsed, attempts: attempt, algoVersion: item.result?.parameter?.version, algoTime: item.result?.extra?.algo_msg?.alg_time }, rawResult: { errorCode: item.result?.error_code, errorMsg: item.result?.error_msg, parameter: item.result?.parameter, duration: item.result?.duration, bizPerf: item.result?.biz_performance_data } };
            }

            log.push({ attempt, state: "processing", algoMs: item.result?.duration?.alg_process_time ?? 0, elapsed });
        }

        this.te("poll");
        throw Object.assign(new Error(`Timeout after ${timeoutMs}ms`), { pollLog: log });
    }

    async downloadResult(url: string, outFilename: string) {
        this.t("download");
        const outPath = path.join(this.outputDir, outFilename);
        const res = await axios.get(url, { responseType: "stream", timeout: 120_000, headers: { "Referer": API.BASE } });
        await new Promise<void>((ok, fail) => { const w = fs.createWriteStream(outPath); res.data.pipe(w); w.on("finish", ok); w.on("error", fail); });
        this.te("download");
        return { outPath, diskSize: fs.statSync(outPath).size };
    }

    buildReport({ initData, upload, task, result, download }: any) {
        return {
            meta: { generatedAt: new Date().toISOString(), gnum: this.gnum, clientId: CLIENT.ID, version: CLIENT.VERSION, country: this.country, timezone: this.timezone, language: this.language },
            timing: { initMs: this.timing.init?.ms, uploadMs: this.timing.upload?.ms, submitMs: this.timing.submit?.ms, pollMs: this.timing.poll?.ms, downloadMs: this.timing.download?.ms, totalMs: Object.values(this.timing).reduce((s: number, v: any) => s + (v.ms ?? 0), 0) },
            platform: { countryCode: initData?.platform?.country_code, taskGroupMaxCount: initData?.task_group?.max_executing_count, taskGroupSubtasks: initData?.task_group?.max_subtask_count, availableTaskTypes: initData?.task_types?.map((t: any) => ({ name: t.name, task_type: t.task_type, vipNeeded: !!t.task_group_need_vip, desc: t.index_desc })) },
            input:  { filePath: upload?.localPath, fileName: upload?.fileName, localSize: upload?.localSize, meta: upload?.meta },
            upload: { fileKey: upload?.fileKey, fileUrl: upload?.fileUrl, etag: upload?.etag, storage: upload?.storage, sign: upload?.sign },
            task:   { name: task?.taskName, type: task?.taskCfg?.type, typeLabel: task?.taskCfg?.label, contentType: task?.taskCfg?.content_type, prepareMsgId: task?.prepareMsgId, predictMs: task?.predictElapsed, beans: task?.beans },
            result: { msgId: result?.msgId, typeName: result?.typeName, taskName: result?.taskName, media: result?.media, performance: result?.performance, raw: result?.rawResult, pollLog: result?.pollLog },
            output: { path: download?.outPath, diskSize: download?.diskSize },
        };
    }
}
