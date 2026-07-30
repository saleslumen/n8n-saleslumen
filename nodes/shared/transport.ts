import type {
	IExecuteFunctions,
	IHttpRequestOptions,
	IDataObject,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

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
			description:
				'The API key needs emails.read for discover and emails.write for verify. Other products need their own read/write permissions.',
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
