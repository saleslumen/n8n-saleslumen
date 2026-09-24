import type {
	IExecuteFunctions,
	IHttpRequestOptions,
	IDataObject,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { ContractError } from './contract';

export const PRODUCT_BASE_URLS = {
	emails: 'https://emails.saleslumenapis.com',
	campaigns: 'https://campaigns.saleslumenapis.com',
	workflows: 'https://workflows.saleslumenapis.com',
	script: 'https://script.saleslumenapis.com',
} as const;

export type SaleslumenProduct = keyof typeof PRODUCT_BASE_URLS;

export async function saleslumenApiRequest(
	this: IExecuteFunctions,
	product: SaleslumenProduct,
	options: Omit<IHttpRequestOptions, 'url'> & { path: string },
	itemIndex = 0,
): Promise<unknown> {
	const { path, ...rest } = options;
	const baseURL = PRODUCT_BASE_URLS[product];
	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, 'saleslumenApi', {
			...rest,
			baseURL,
			url: path,
		});
	} catch (error) {
		throw mapSaleslumenApiError(this, error as JsonObject, itemIndex);
	}
}

export function mapSaleslumenApiError(
	ctx: IExecuteFunctions,
	error: JsonObject,
	itemIndex = 0,
): NodeApiError {
	const httpCode = String(error.httpCode ?? error.statusCode ?? '');
	const nested = (error as IDataObject).error as IDataObject | undefined;
	const apiMessage =
		(typeof nested?.message === 'string' && nested.message) ||
		(typeof error.message === 'string' && error.message) ||
		'Saleslumen API request failed';
	const details = nested?.details as IDataObject | undefined;
	if (httpCode === '402') {
		const balance = details?.balance;
		const required = details?.required;
		return new NodeApiError(ctx.getNode(), error, {
			message: 'Insufficient Saleslumen credits',
			description:
				balance !== undefined && required !== undefined
					? `Need ${required} credits, have ${balance}. Add credits, then retry. A 402 request is not processed or billed.`
					: 'Add credits in Saleslumen, then retry. A 402 request is not processed or billed.',
			itemIndex,
		});
	}
	if (httpCode === '401') {
		return new NodeApiError(ctx.getNode(), error, {
			message: 'Saleslumen authentication failed',
			description:
				'Check the API key. Send only sl-api-key (never Authorization Bearer for organization keys).',
			itemIndex,
		});
	}
	if (httpCode === '403') {
		return new NodeApiError(ctx.getNode(), error, {
			message: 'Saleslumen permission denied',
			description: 'The credential is missing permission for this operation.',
			itemIndex,
		});
	}
	if (httpCode === '429') {
		return new NodeApiError(ctx.getNode(), error, {
			message: 'Saleslumen capacity exhausted',
			description: 'Shared storage is full. Free capacity, then retry. The request was not applied.',
			itemIndex,
		});
	}
	return new NodeApiError(ctx.getNode(), error, {
		message: apiMessage,
		itemIndex,
	});
}

export function parseNdjson(body: string): IDataObject[] {
	return body
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => JSON.parse(line) as IDataObject);
}

const LIST_CAP = 1000;

export function rethrowSaleslumenError(ctx: IExecuteFunctions, error: unknown, itemIndex: number): never {
	if (error instanceof ContractError) {
		throw new NodeOperationError(ctx.getNode(), error.message, { itemIndex });
	}
	if (error instanceof NodeApiError) throw new NodeApiError(ctx.getNode(), error as unknown as JsonObject);
	if (error instanceof NodeOperationError) throw new NodeOperationError(ctx.getNode(), error, { itemIndex });
	throw new NodeApiError(ctx.getNode(), error as JsonObject, { itemIndex });
}

export async function assertUserAccessToken(this: IExecuteFunctions, itemIndex = 0): Promise<void> {
	const credentials = await this.getCredentials('saleslumenApi');
	const token = String(credentials.accessToken ?? '').trim();
	if (credentials.authentication !== 'accessToken' || !token) {
		throw new NodeOperationError(this.getNode(), 'A user access token is required', {
			description:
				'This operation rejects organization API keys. Set Authentication on the Saleslumen API credential to Access Token.',
			itemIndex,
		});
	}
}

export function listPageQuery(query: IDataObject, requestTokenKey: string, token: string): IDataObject {
	const qs: IDataObject = { ...query };
	delete qs[requestTokenKey];
	const cursor = token.trim();
	if (cursor) qs[requestTokenKey] = cursor;
	return qs;
}

export async function collectList(
	this: IExecuteFunctions,
	product: SaleslumenProduct,
	itemIndex: number,
	input: {
		path: string;
		itemsKey: string;
		requestTokenKey: string;
		responseTokenKey: string;
		query: IDataObject;
		returnAll: boolean;
	},
): Promise<IDataObject[]> {
	const rows: IDataObject[] = [];
	const baseQuery: IDataObject = { ...input.query };
	delete baseQuery[input.requestTokenKey];
	delete baseQuery[input.responseTokenKey];
	let token =
		typeof input.query[input.requestTokenKey] === 'string'
			? String(input.query[input.requestTokenKey]).trim()
			: '';
	let lastTotalCount: number | undefined;
	do {
		const qs = listPageQuery(baseQuery, input.requestTokenKey, token);
		const page = (await saleslumenApiRequest.call(
			this,
			product,
			{ method: 'GET', path: input.path, qs, json: true },
			itemIndex,
		)) as IDataObject;
		const items = page[input.itemsKey];
		if (!Array.isArray(items)) {
			throw new NodeOperationError(this.getNode(), `Saleslumen list response is missing ${input.itemsKey}`, {
				itemIndex,
			});
		}
		rows.push(...(items as IDataObject[]));
		if (typeof page.totalCount === 'number') lastTotalCount = page.totalCount;
		const nextToken = page[input.responseTokenKey];
		token = typeof nextToken === 'string' ? nextToken.trim() : '';
		if (!input.returnAll || rows.length >= LIST_CAP) break;
	} while (token);
	if (rows.length > 0) {
		const trailing: IDataObject = {};
		if (token) trailing[input.responseTokenKey] = token;
		if (lastTotalCount !== undefined) trailing.totalCount = lastTotalCount;
		if (Object.keys(trailing).length > 0) {
			rows[rows.length - 1] = { ...rows[rows.length - 1], ...trailing };
		}
	}
	return rows;
}
