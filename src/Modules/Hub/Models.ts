import mongoose, { Schema, Document } from 'mongoose';

// ─── HubUser ──────────────────────────────────────────────────────────────────
export interface IHubUser extends Document {
    email: string;
    passwordHash: string;
    displayName?: string;
    avatarUrl?: string;
    credits: number;
    sandboxCredits: number;
    plan: string;
    emailVerified: boolean;
    emailVerifyToken?: string;
    emailVerifyExpiry?: Date;
    theme?: string;
    language?: string;
    createdAt: Date;
    updatedAt: Date;
}

const HubUserSchema = new Schema<IHubUser>({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: String,
    avatarUrl: String,
    credits: { type: Number, default: 20 },
    sandboxCredits: { type: Number, default: 10 },
    plan: { type: String, default: 'free' },
    emailVerified: { type: Boolean, default: false },
    emailVerifyToken: String,
    emailVerifyExpiry: Date,
    theme: { type: String, default: 'auralixDefault' },
    language: { type: String, default: 'es' },
}, { timestamps: true });

export const HubUser = mongoose.model<IHubUser>('HubUser', HubUserSchema, 'hub_users');

// ─── HubSnippet ───────────────────────────────────────────────────────────────
export interface IHubSnippet extends Document {
    userId: mongoose.Types.ObjectId;
    title: string;
    language: string;
    code: string;
    passwordHash?: string;
    shortId: string;
    viewCount: number;
    createdAt: Date;
}

const HubSnippetSchema = new Schema<IHubSnippet>({
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'HubUser' },
    title: { type: String, required: true, maxlength: 200 },
    language: { type: String, default: 'plaintext' },
    code: { type: String, required: true, maxlength: 200000 },
    passwordHash: String,
    shortId: { type: String, required: true, unique: true },
    viewCount: { type: Number, default: 0 },
}, { timestamps: true });

export const HubSnippet = mongoose.model<IHubSnippet>('HubSnippet', HubSnippetSchema, 'hub_snippets');

// ─── HubTransaction ───────────────────────────────────────────────────────────
export interface IHubTransaction extends Document {
    userId: mongoose.Types.ObjectId;
    type: 'purchase' | 'deduct' | 'refund';
    planId?: string;
    credits: number;
    provider?: string;
    status: 'pending' | 'completed' | 'failed';
    paymentId?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
}

const HubTransactionSchema = new Schema<IHubTransaction>({
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'HubUser' },
    type: { type: String, enum: ['purchase', 'deduct', 'refund'], required: true },
    planId: String,
    credits: { type: Number, required: true },
    provider: String,
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    paymentId: String,
    metadata: Schema.Types.Mixed,
}, { timestamps: true });

export const HubTransaction = mongoose.model<IHubTransaction>('HubTransaction', HubTransactionSchema, 'hub_transactions');

// ─── HubRequestLog ────────────────────────────────────────────────────────────
export interface IHubRequestLog extends Document {
    userId: mongoose.Types.ObjectId;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTimeMs: number;
    isSandbox: boolean;
    creditsDeducted: number;
    ip?: string;
    createdAt: Date;
}

const HubRequestLogSchema = new Schema<IHubRequestLog>({
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'HubUser' },
    endpoint: { type: String, required: true },
    method: { type: String, required: true },
    statusCode: { type: Number, required: true },
    responseTimeMs: { type: Number, default: 0 },
    isSandbox: { type: Boolean, default: false },
    creditsDeducted: { type: Number, default: 0 },
    ip: String,
}, { timestamps: true });

export const HubRequestLog = mongoose.model<IHubRequestLog>('HubRequestLog', HubRequestLogSchema, 'hub_request_logs');

// ─── HubCaptcha ───────────────────────────────────────────────────────────────
export interface IHubCaptcha extends Document {
    challengeId: string;
    answer: string;
    expiresAt: Date;
    used: boolean;
}

const HubCaptchaSchema = new Schema<IHubCaptcha>({
    challengeId: { type: String, required: true, unique: true },
    answer: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    used: { type: Boolean, default: false },
});

export const HubCaptcha = mongoose.model<IHubCaptcha>('HubCaptcha', HubCaptchaSchema, 'hub_captchas');
