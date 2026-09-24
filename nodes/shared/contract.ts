import { randomUUID } from 'node:crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VARIABLE_NAME_RE = /^[a-z][a-z0-9_]{0,63}$/;
const VERIFY_FEATURES = ['STANDARD', 'CATCH_ALL'] as const;
const TRIGGER_EVENTS = ['EMAIL.OPENED', 'EMAIL.CLICKED', 'EMAIL.REPLIED'] as const;
const SEQUENCE_READ_ONLY = new Set(['name', 'campaign', 'kind', 'etag', 'create_time', 'update_time']);

export class ContractError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ContractError';
	}
}

export function pathId(value: string): string {
	const trimmed = value.trim();
	const slash = trimmed.lastIndexOf('/');
	return (slash >= 0 ? trimmed.slice(slash + 1) : trimmed).trim();
}

export function requireUuid(value: string, label: string): string {
	const id = pathId(value);
	if (!UUID_RE.test(id)) throw new ContractError(`${label} must be a UUID`);
	return id;
}

export function organizationResourceName(organizationId: string): string {
	return `organizations/${requireUuid(organizationId, 'Organization ID')}`;
}

export function resolveRequestId(value: string, generate: () => string = () => randomUUID()): string {
	const trimmed = value.trim();
	if (!trimmed) return generate();
	if (!UUID_RE.test(trimmed)) throw new ContractError('Request ID must be a UUID');
	return trimmed;
}

export function verifyBody(emails: string[], features: string[]): { emails: string[]; features: string[] } {
	const unique: string[] = [];
	for (const feature of features) {
		if (!VERIFY_FEATURES.includes(feature as (typeof VERIFY_FEATURES)[number])) {
			throw new ContractError('Features must be Standard, Catch-All, or both');
		}
		if (!unique.includes(feature)) unique.push(feature);
	}
	if (unique.length === 0) throw new ContractError('Select at least one verification feature');
	return { emails, features: unique };
}

export function variableNames(raw: string): string[] {
	const names = raw.split(',').map((name) => name.trim()).filter(Boolean);
	for (const name of names) {
		if (!VARIABLE_NAME_RE.test(name)) throw new ContractError(`Variable name '${name}' is invalid`);
	}
	return names;
}

export function uuidList(raw: string, label: string): string[] {
	const ids = raw.split(',').map((value) => value.trim()).filter(Boolean).map((value) => requireUuid(value, label));
	return ids;
}

export function jsonValue(value: unknown, label: string): unknown {
	if (typeof value !== 'string') return value;
	try {
		return JSON.parse(value.trim() === '' ? 'null' : value);
	} catch {
		return invalidJson(label);
	}
}

function invalidJson(label: string): never {
	throw new ContractError(`${label} must be valid JSON`);
}

export function stringMap(value: unknown, label: string): Record<string, string> {
	const parsed = jsonValue(value, label);
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new ContractError(`${label} must be a JSON object of strings`);
	}
	const out: Record<string, string> = {};
	for (const [key, item] of Object.entries(parsed as Record<string, unknown>)) {
		if (typeof item !== 'string') throw new ContractError(`${label}.${key} must be a string`);
		out[key] = item;
	}
	return out;
}

export function campaignUpdateBody(
	fields: Record<string, unknown>,
	etag: string,
	requestId: string,
): Record<string, unknown> {
	const mask = Object.keys(fields);
	if (mask.length === 0) throw new ContractError('Add at least one update field');
	if (!etag.trim()) throw new ContractError('Etag is required');
	return { campaign: fields, update_mask: mask.join(','), etag: etag.trim(), request_id: requestId };
}

export function sequenceTrigger(input: {
	eventType: string;
	srlExpression: string;
	priority: number;
	entryDelaySeconds: number;
}): Record<string, unknown> {
	if (!TRIGGER_EVENTS.includes(input.eventType as (typeof TRIGGER_EVENTS)[number])) {
		throw new ContractError('Event type must be EMAIL.OPENED, EMAIL.CLICKED, or EMAIL.REPLIED');
	}
	const expression = input.srlExpression.trim();
	if (!expression) throw new ContractError('SRL expression is required');
	if (!Number.isInteger(input.priority) || input.priority < 0) {
		throw new ContractError('Priority must be a nonnegative integer');
	}
	if (!Number.isInteger(input.entryDelaySeconds) || input.entryDelaySeconds < 0) {
		throw new ContractError('Entry delay must be a nonnegative integer');
	}
	return {
		event_type: input.eventType,
		srl_expression: expression,
		priority: input.priority,
		entry_delay_seconds: input.entryDelaySeconds,
	};
}

export function optionalSteps(value: unknown): unknown[] | undefined {
	const parsed = jsonValue(value, 'Steps');
	if (parsed == null) return undefined;
	if (!Array.isArray(parsed)) throw new ContractError('Steps must be a JSON array');
	if (parsed.length === 0) return undefined;
	return parsed;
}

export function sequencePayload(value: unknown): Record<string, unknown> {
	const parsed = jsonValue(value, 'Sequence');
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new ContractError('Sequence must be a JSON object');
	}
	const body: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(parsed as Record<string, unknown>)) {
		if (!SEQUENCE_READ_ONLY.has(key)) body[key] = item;
	}
	if (Object.keys(body).length === 0) {
		throw new ContractError('Sequence must include display_name, trigger, or steps');
	}
	return body;
}

export function pageSize(value: number): number {
	if (!Number.isInteger(value) || value < 1 || value > 200) {
		throw new ContractError('Page Size must be an integer from 1 to 200');
	}
	return value;
}

export function scriptProjectContent(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new ContractError('Content must be a JSON object with a files array');
	}
	const root = value as Record<string, unknown>;
	if (Array.isArray(root.files)) {
		return { files: root.files };
	}
	const wrapped = root.content;
	if (wrapped && typeof wrapped === 'object' && !Array.isArray(wrapped)) {
		const nested = wrapped as Record<string, unknown>;
		if (Array.isArray(nested.files) && Object.keys(root).length === 1) {
			return { files: nested.files };
		}
	}
	throw new ContractError('Content must be a JSON object with a files array');
}

export function scriptRunFailure(operation: Record<string, unknown>): string | undefined {
	const preStart = operation.error;
	if (preStart) {
		if (typeof preStart === 'string') return preStart;
		if (typeof preStart === 'object' && preStart !== null) {
			const message = (preStart as Record<string, unknown>).message;
			if (typeof message === 'string' && message) return message;
		}
		return JSON.stringify(preStart);
	}
	const response = operation.response;
	if (!response || typeof response !== 'object' || Array.isArray(response)) {
		return 'Script run did not return a response envelope';
	}
	const body = response as Record<string, unknown>;
	if (body.success === true && body.commit_state !== 'UNKNOWN') return undefined;
	if (typeof body.error === 'string' && body.error) return body.error;
	const serializationError = body.serialization_error;
	if (body.success !== true && typeof serializationError === 'string' && serializationError) {
		return serializationError;
	}
	if (body.commit_state === 'UNKNOWN') {
		return 'Script run outcome is unknown; do not retry automatically';
	}
	return 'Script function failed';
}
