import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { parseNdjson, saleslumenApiRequest, sleep } from '../shared/transport';

type DiscoverResponse = {
	kind?: string;
	status?: string;
	data?: IDataObject;
};

export class SaleslumenEmails implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Saleslumen Emails',
		name: 'saleslumenEmails',
		icon: { light: 'file:product.svg', dark: 'file:product.dark.svg' },
		group: ['transform'],
		version: [1],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Discover and verify email addresses with Saleslumen Emails',
		defaults: { name: 'Saleslumen Emails' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'saleslumenApi', required: true }],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'Tool', value: 'tool' }],
				default: 'tool',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['tool'] } },
				options: [
					{
						name: 'Discover',
						value: 'discover',
						action: 'Discover email',
						description: 'Find a person email for a domain',
					},
					{
						name: 'Verify',
						value: 'verify',
						action: 'Verify emails',
						description: 'Run standard email verification',
					},
					{
						name: 'Verify Catch-All',
						value: 'verifyCatchAll',
						action: 'Verify catch all emails',
						description: 'Run catch-all email verification',
					},
				],
				default: 'discover',
			},
			{
				displayName: 'Domain',
				name: 'domain',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'e.g. example.com',
				displayOptions: { show: { resource: ['tool'], operation: ['discover'] } },
				description: 'Company domain to search',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'e.g. Jane Doe',
				displayOptions: { show: { resource: ['tool'], operation: ['discover'] } },
				description: 'Person name to resolve',
			},
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				default: '',
				placeholder: 'e.g. nathan@example.com',
				displayOptions: { show: { resource: ['tool'], operation: ['verify', 'verifyCatchAll'] } },
				description: 'Email to verify. Leave empty to use the email field from each input item.',
			},
			{
				displayName: 'Email Field',
				name: 'emailField',
				type: 'string',
				default: 'email',
				displayOptions: { show: { resource: ['tool'], operation: ['verify', 'verifyCatchAll'] } },
				description: 'Input item field that holds the email when Email is empty',
			},
			{
				displayName: 'Batch',
				name: 'batch',
				type: 'boolean',
				default: true,
				displayOptions: { show: { resource: ['tool'], operation: ['verify', 'verifyCatchAll'] } },
				description: 'Whether to send all input emails in one request and fan out address results',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Poll Interval (Ms)',
						name: 'pollIntervalMs',
						type: 'number',
						default: 2000,
						description: 'Delay between discover status polls',
					},
					{
						displayName: 'Max Wait (Ms)',
						name: 'maxWaitMs',
						type: 'number',
						default: 300000,
						description: 'Maximum time to wait for discover to finish',
					},
					{
						displayName: 'Include Summary',
						name: 'includeSummary',
						type: 'boolean',
						default: false,
						description: 'Whether to emit the final verify summary line as an item',
					},
					{
						displayName: 'Timeout (Ms)',
						name: 'timeoutMs',
						type: 'number',
						default: 600000,
						description: 'HTTP timeout for verify streams',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const operation = this.getNodeParameter('operation', 0) as string;
		if (operation === 'discover') {
			return [await executeDiscover.call(this, items)];
		}
		if (operation === 'verify' || operation === 'verifyCatchAll') {
			const stage = operation === 'verify' ? 'standard' : 'catch_all';
			const batch = this.getNodeParameter('batch', 0, true) as boolean;
			if (batch) {
				return [await executeVerifyBatch.call(this, items, stage)];
			}
			return [await executeVerifyPerItem.call(this, items, stage)];
		}
		throw new NodeOperationError(this.getNode(), `Unknown operation '${operation}'`);
	}
}

async function executeDiscover(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	for (let i = 0; i < items.length; i++) {
		try {
			const domain = this.getNodeParameter('domain', i) as string;
			const name = this.getNodeParameter('name', i) as string;
			const options = this.getNodeParameter('options', i, {}) as IDataObject;
			const pollIntervalMs = Number(options.pollIntervalMs ?? 2000);
			const maxWaitMs = Number(options.maxWaitMs ?? 300000);
			const started = Date.now();
			let body: DiscoverResponse;
			while (true) {
				body = (await saleslumenApiRequest.call(
					this,
					'emails',
					{ method: 'GET', path: '/v1/tools:discover', qs: { domain, name }, json: true },
					i,
				)) as DiscoverResponse;
				const status = body.status;
				if (status === 'success' || status === 'not_found') break;
				if (status !== 'pending' && status !== 'running') {
					throw new NodeOperationError(this.getNode(), `Unexpected discover status '${status}'`, {
						itemIndex: i,
					});
				}
				if (Date.now() - started > maxWaitMs) {
					throw new NodeOperationError(this.getNode(), 'Discover timed out while still pending', {
						description: 'Increase Max Wait or retry later. Pending polls are not billed.',
						itemIndex: i,
					});
				}
				await sleep(pollIntervalMs);
			}
			if (body.status === 'success') {
				const results = ((body.data?.results as IDataObject[]) ?? []).map((row) => ({
					json: {
						status: 'success',
						domain,
						name,
						email: row.email,
						checkedAt: row.checkedAt,
					},
					pairedItem: { item: i },
				}));
				if (results.length === 0) {
					returnData.push({
						json: { status: 'success', domain, name, email: null },
						pairedItem: { item: i },
					});
				} else {
					returnData.push(...results);
				}
			} else {
				returnData.push({
					json: {
						status: 'not_found',
						domain,
						name,
						message: (body.data?.message as string) ?? 'No valid email addresses found',
					},
					pairedItem: { item: i },
				});
			}
		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({
					json: { error: (error as Error).message },
					pairedItem: { item: i },
				});
				continue;
			}
			throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
		}
	}
	return returnData;
}

function resolveEmail(this: IExecuteFunctions, itemIndex: number, item: INodeExecutionData): string {
	const direct = (this.getNodeParameter('email', itemIndex, '') as string).trim();
	if (direct) return direct;
	const field = (this.getNodeParameter('emailField', itemIndex, 'email') as string) || 'email';
	const value = item.json[field];
	return typeof value === 'string' ? value.trim() : '';
}

async function verifyEmailsRequest(
	this: IExecuteFunctions,
	stage: 'standard' | 'catch_all',
	emails: string[],
	itemIndex: number,
): Promise<IDataObject[]> {
	const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
	const timeout = Number(options.timeoutMs ?? 600000);
	const path = stage === 'standard' ? '/v1/tools:verify' : '/v1/tools:verifyCatchAll';
	const response = (await saleslumenApiRequest.call(
		this,
		'emails',
		{
			method: 'POST',
			path,
			headers: { 'Content-Type': 'text/plain', Accept: 'application/x-ndjson' },
			body: emails.join('\n'),
			encoding: 'text',
			json: false,
			returnFullResponse: true,
			timeout,
		},
		itemIndex,
	)) as { body: string };
	const bodyText = typeof response.body === 'string' ? response.body : String(response.body ?? '');
	const rows = parseNdjson(bodyText);
	const hasDone = rows.some((row) => row.done === true);
	const streamError = rows.find((row) => row.error === true);
	if (streamError) {
		throw new NodeOperationError(
			this.getNode(),
			String(streamError.message ?? 'Verification failed'),
			{ itemIndex },
		);
	}
	if (!hasDone) {
		throw new NodeOperationError(
			this.getNode(),
			'Verification stream ended without a done summary',
			{
				description: 'Retry only unfinished addresses. Do not re-verify completed valid/invalid results.',
				itemIndex,
			},
		);
	}
	return rows;
}

async function executeVerifyBatch(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	stage: 'standard' | 'catch_all',
): Promise<INodeExecutionData[]> {
	const emails: string[] = [];
	const sourceIndex: number[] = [];
	for (let i = 0; i < items.length; i++) {
		const email = resolveEmail.call(this, i, items[i]);
		if (!email.includes('@')) {
			if (this.continueOnFail()) continue;
			throw new NodeOperationError(this.getNode(), 'Email is required', { itemIndex: i });
		}
		emails.push(email);
		sourceIndex.push(i);
	}
	if (emails.length === 0) {
		throw new NodeOperationError(this.getNode(), 'No emails found in input');
	}
	const options = this.getNodeParameter('options', 0, {}) as IDataObject;
	const includeSummary = Boolean(options.includeSummary);
	try {
		const rows = await verifyEmailsRequest.call(this, stage, emails, 0);
		const returnData: INodeExecutionData[] = [];
		const lowerEmails = emails.map((e) => e.toLowerCase());
		for (const row of rows) {
			if (row.done === true) {
				if (includeSummary) {
					returnData.push({ json: row, pairedItem: { item: sourceIndex[0] ?? 0 } });
				}
				continue;
			}
			const email = String(row.email ?? '').toLowerCase();
			const idx = lowerEmails.indexOf(email);
			const itemIndex = idx >= 0 ? sourceIndex[idx] : sourceIndex[0] ?? 0;
			returnData.push({ json: row, pairedItem: { item: itemIndex } });
		}
		return returnData;
	} catch (error) {
		if (this.continueOnFail()) {
			return [{ json: { error: (error as Error).message }, pairedItem: { item: sourceIndex[0] ?? 0 } }];
		}
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: sourceIndex[0] ?? 0 });
	}
}

async function executeVerifyPerItem(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	stage: 'standard' | 'catch_all',
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const options = this.getNodeParameter('options', 0, {}) as IDataObject;
	const includeSummary = Boolean(options.includeSummary);
	for (let i = 0; i < items.length; i++) {
		try {
			const email = resolveEmail.call(this, i, items[i]);
			if (!email.includes('@')) {
				throw new NodeOperationError(this.getNode(), 'Email is required', { itemIndex: i });
			}
			const rows = await verifyEmailsRequest.call(this, stage, [email], i);
			for (const row of rows) {
				if (row.done === true) {
					if (includeSummary) returnData.push({ json: row, pairedItem: { item: i } });
					continue;
				}
				returnData.push({ json: row, pairedItem: { item: i } });
			}
		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({
					json: { error: (error as Error).message },
					pairedItem: { item: i },
				});
				continue;
			}
			throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
		}
	}
	return returnData;
}
