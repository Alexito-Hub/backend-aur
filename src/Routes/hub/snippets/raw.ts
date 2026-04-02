import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { HubSnippet } from '../../../Modules/Hub/Models';

const SHORT_ID_PATTERN = /^[a-f0-9]{10}$/i;

function getPasswordFromRequest(req: Request): string {
	const headerValue = req.headers['x-snippet-password'];
	if (typeof headerValue === 'string' && headerValue.trim()) return headerValue.trim();
	if (Array.isArray(headerValue) && typeof headerValue[0] === 'string' && headerValue[0].trim()) {
		return headerValue[0].trim();
	}

	return '';
}

function normalizeShortId(value: unknown): string {
	if (typeof value !== 'string') return '';
	return value.trim().toLowerCase();
}

function getRequestToken(req: Request): string {
	const auth = typeof req.headers.authorization === 'string'
		? req.headers.authorization.trim()
		: '';
	if (auth.toLowerCase().startsWith('bearer ')) {
		const token = auth.slice(7).trim();
		if (token) return token;
	}

	const cookieToken = typeof (req as any).cookies?.hub_token === 'string'
		? (req as any).cookies.hub_token.trim()
		: '';

	return cookieToken;
}

function getAuthenticatedUserId(req: Request): string {
	const token = getRequestToken(req);
	if (!token) return '';

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as {
			userId?: string;
			sub?: string;
		};
		return (decoded.userId || decoded.sub || '').trim();
	} catch {
		return '';
	}
}

export default {
	name: 'Hub Raw Snippet',
	path: '/s/:id/raw',
	method: 'get',
	category: 'hub',
	execution: async (req: Request, res: Response) => {
		const id = normalizeShortId(req.params?.id);
		if (!SHORT_ID_PATTERN.test(id)) {
			return res.status(400).json({ status: false, msg: 'ID de snippet inválido' });
		}

		const password = getPasswordFromRequest(req);

		const snippet = await HubSnippet.findOne({ shortId: id });
		if (!snippet) {
			return res.status(404).json({ status: false, msg: 'Snippet no encontrado' });
		}

		if ((snippet as any).allowRaw === false) {
			return res.status(403).json({ status: false, msg: 'La vista RAW está deshabilitada para este snippet' });
		}

		if (snippet.passwordHash) {
			const authUserId = getAuthenticatedUserId(req);
			const ownerId = String((snippet as any).userId || '').trim();
			const isOwner = ownerId.length > 0 && ownerId === authUserId;

			if (!isOwner && !password) {
				return res.status(401).json({ status: false, requiresPassword: true, msg: 'Contraseña requerida' });
			}

			if (!isOwner) {
				const match = await bcrypt.compare(password, snippet.passwordHash);
				if (!match) {
					return res.status(401).json({ status: false, msg: 'Contraseña incorrecta' });
				}
			}
		}

		res.setHeader('Content-Type', 'text/plain; charset=utf-8');
		res.setHeader('Cache-Control', 'no-store');
		return res.status(200).send(snippet.code || '');
	},
};
