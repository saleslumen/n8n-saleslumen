import { ContractError } from './contract';

export type VerificationStage = 'standard' | 'catch_all';

export const VERIFY_MAX_WITH_STANDARD = 1000;
export const VERIFY_MAX_CATCH_ALL_ONLY = 100;

export function normalizeVerifyEmail(email: string): string {
	return email.trim().toLowerCase();
}

export function uniqueNormalizedVerifyEmails(rawEmails: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of rawEmails) {
		const normalized = normalizeVerifyEmail(raw);
		if (seen.has(normalized)) continue;
		seen.add(normalized);
		out.push(normalized);
	}
	return out;
}

export function verifyBatchAddressLimit(features: string[]): number {
	return features.includes('STANDARD') ? VERIFY_MAX_WITH_STANDARD : VERIFY_MAX_CATCH_ALL_ONLY;
}

export function assertVerifyBatchWithinLimit(uniqueCount: number, features: string[]): void {
	const limit = verifyBatchAddressLimit(features);
	if (uniqueCount > limit) {
		throw new ContractError(`At most ${limit} unique addresses for the selected verification features`);
	}
}

export function requiredVerifyDoneStages(features: string[]): VerificationStage[] {
	const stages: VerificationStage[] = [];
	if (features.includes('STANDARD')) stages.push('standard');
	if (features.includes('CATCH_ALL')) stages.push('catch_all');
	return stages;
}

export function missingVerifyDoneStages(
	rows: Array<Record<string, unknown>>,
	features: string[],
): VerificationStage[] {
	const required = requiredVerifyDoneStages(features);
	const doneStages = new Set<string>();
	for (const row of rows) {
		if (row.done === true && typeof row.stage === 'string') doneStages.add(row.stage);
	}
	return required.filter((stage) => !doneStages.has(stage));
}

export type VerifyStreamValidation =
	| { kind: 'ok' }
	| { kind: 'stream_error'; message: string }
	| { kind: 'incomplete'; missingStages: VerificationStage[] };

export function validateVerifyStreamRows(
	rows: Array<Record<string, unknown>>,
	features: string[],
): VerifyStreamValidation {
	const streamError = rows.find((row) => row.error === true);
	if (streamError) {
		return {
			kind: 'stream_error',
			message: String(streamError.message ?? 'Verification failed'),
		};
	}
	const missingStages = missingVerifyDoneStages(rows, features);
	if (missingStages.length > 0) return { kind: 'incomplete', missingStages };
	return { kind: 'ok' };
}
