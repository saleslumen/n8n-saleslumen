import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import {
	campaignUpdateBody,
	ContractError,
	optionalSteps,
	organizationResourceName,
	pageSize,
	requireUuid,
	resolveRequestId,
	sequencePayload,
	sequenceTrigger,
	stringMap,
	uuidList,
	variableNames,
} from '../shared/contract';
import { collectList, rethrowSaleslumenError, saleslumenApiRequest } from '../shared/transport';

const LIFECYCLE = [
	'activateCampaign',
	'archiveCampaign',
	'completeCampaign',
	'pauseCampaign',
	'resumeCampaign',
	'unarchiveCampaign',
] as const;

const CAMPAIGN_ID_OPS = [
	...LIFECYCLE,
	'createPerson',
	'createSequence',
	'deleteCampaign',
	'deleteSequence',
	'getCampaign',
	'getManySequences',
	'getSequence',
	'setSenderAccounts',
	'setVariables',
	'updateCampaign',
	'updateSequence',
];

const ETAG_OPS = [
	...LIFECYCLE,
	'deleteCampaign',
	'deleteSequence',
	'setSenderAccounts',
	'setVariables',
	'updateCampaign',
	'updateSequence',
];

const REQUEST_ID_OPS = [
	...LIFECYCLE,
	'createCampaign',
	'createPerson',
	'createSequence',
	'deleteCampaign',
	'deleteSequence',
	'setSenderAccounts',
	'setVariables',
	'updateCampaign',
	'updateSequence',
];

const COMMANDS: Record<string, string> = {
	activateCampaign: 'activate',
	archiveCampaign: 'archive',
	completeCampaign: 'complete',
	pauseCampaign: 'pause',
	resumeCampaign: 'resume',
	unarchiveCampaign: 'unarchive',
};

function show(operation: string[]): INodeProperties['displayOptions'] {
	return { show: { resource: ['campaigns'], operation } };
}

export const campaignsProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['campaigns'] } },
		options: [
			{ name: 'Activate', value: 'activateCampaign', action: 'Activate a campaign', description: 'Activate a campaign when it is ready' },
			{ name: 'Archive', value: 'archiveCampaign', action: 'Archive a campaign', description: 'Archive a draft, paused, or completed campaign' },
			{ name: 'Complete', value: 'completeCampaign', action: 'Complete a campaign', description: 'Mark a campaign completed' },
			{ name: 'Create', value: 'createCampaign', action: 'Create a campaign', description: 'Create a draft campaign and its main sequence' },
			{ name: 'Create Person', value: 'createPerson', action: 'Create a person', description: 'Enroll one person' },
			{ name: 'Create Sequence', value: 'createSequence', action: 'Create a sequence', description: 'Create a triggered sequence' },
			{ name: 'Delete', value: 'deleteCampaign', action: 'Delete a campaign', description: 'Delete a draft campaign that has no deliveries' },
			{ name: 'Delete Sequence', value: 'deleteSequence', action: 'Delete a sequence', description: 'Delete an unused triggered sequence' },
			{ name: 'Get', value: 'getCampaign', action: 'Get a campaign', description: 'Get a campaign by ID' },
			{ name: 'Get Many', value: 'getManyCampaigns', action: 'Get many campaigns', description: 'List campaigns' },
			{ name: 'Get Many Sequences', value: 'getManySequences', action: 'Get many sequences', description: 'List sequences' },
			{ name: 'Get Sequence', value: 'getSequence', action: 'Get a sequence', description: 'Get a sequence tree' },
			{ name: 'Pause', value: 'pauseCampaign', action: 'Pause a campaign', description: 'Pause an active campaign' },
			{ name: 'Resume', value: 'resumeCampaign', action: 'Resume a campaign', description: 'Resume a paused campaign' },
			{ name: 'Set Sender Accounts', value: 'setSenderAccounts', action: 'Set sender accounts', description: 'Replace the campaign sender accounts' },
			{ name: 'Set Variables', value: 'setVariables', action: 'Set campaign variables', description: 'Replace declared campaign variables' },
			{ name: 'Unarchive', value: 'unarchiveCampaign', action: 'Unarchive a campaign', description: 'Restore an archived campaign' },
			{ name: 'Update', value: 'updateCampaign', action: 'Update a campaign', description: 'Patch campaign fields with an update mask' },
			{ name: 'Update Sequence', value: 'updateSequence', action: 'Update a sequence', description: 'Replace a sequence tree' },
		],
		default: 'createCampaign',
	},
	{
		displayName: 'Campaign ID',
		name: 'campaignId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: show(CAMPAIGN_ID_OPS),
		description: 'Campaign UUID, or a campaigns/{ID} resource name',
	},
	{
		displayName: 'Sequence ID',
		name: 'sequenceId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: show(['deleteSequence', 'getSequence', 'updateSequence']),
		description: 'Sequence UUID',
	},
	{
		displayName: 'Display Name',
		name: 'displayName',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. Outbound Q3',
		displayOptions: show(['createCampaign', 'createSequence']),
	},
	{
		displayName: 'Visibility',
		name: 'visibility',
		type: 'options',
		options: [
			{ name: 'All', value: 'ALL' },
			{ name: 'Archived', value: 'ARCHIVED' },
			{ name: 'Unarchived', value: 'UNARCHIVED' },
		],
		default: 'UNARCHIVED',
		displayOptions: show(['getManyCampaigns']),
	},
	{
		displayName: 'Etag',
		name: 'etag',
		type: 'string',
		default: '',
		required: true,
		displayOptions: show(ETAG_OPS),
		description: 'Current resource etag from Get',
	},
	{
		displayName: 'Request ID',
		name: 'requestId',
		type: 'string',
		default: '',
		displayOptions: show(REQUEST_ID_OPS),
		description: 'Idempotency UUID. Leave empty to generate one for this execution.',
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['updateCampaign']),
		options: [
			{ displayName: 'Bounce Auto Pause Threshold (Bps)', name: 'bounce_auto_pause_threshold_bps', type: 'number', default: 500, description: 'Basis points from 1 to 10000' },
			{ displayName: 'Content Mode', name: 'content_mode', type: 'options', options: [{ name: 'Multipart', value: 'MULTIPART' }, { name: 'Plain Text', value: 'PLAIN_TEXT' }], default: 'MULTIPART' },
			{ displayName: 'Daily Delivery Limit', name: 'daily_delivery_limit', type: 'number', default: 1 },
			{ displayName: 'Daily New Recipient Limit', name: 'daily_new_recipient_limit', type: 'number', default: 1 },
			{ displayName: 'Display Name', name: 'display_name', type: 'string', default: '' },
			{ displayName: 'Schedule', name: 'schedule', type: 'string', default: '', description: 'Resource name campaignSchedules/{ID}' },
			{ displayName: 'Sender Provider Strategy', name: 'sender_provider_strategy', type: 'options', options: [{ name: 'Any', value: 'ANY' }, { name: 'Prefer Recipient Provider', value: 'PREFER_RECIPIENT_PROVIDER' }], default: 'ANY' },
			{ displayName: 'Stop on Reply', name: 'stop_on_reply', type: 'boolean', default: true },
			{ displayName: 'Track Clicks', name: 'track_clicks', type: 'boolean', default: true },
			{ displayName: 'Track Opens', name: 'track_opens', type: 'boolean', default: true },
			{ displayName: 'Unsubscribe Policy', name: 'unsubscribe_policy', type: 'options', options: [{ name: 'Header and Footer', value: 'HEADER_AND_FOOTER' }, { name: 'None', value: 'NONE' }], default: 'NONE' },
		],
	},
	{
		displayName: 'Variables',
		name: 'variables',
		type: 'string',
		default: 'given_name,family_name',
		displayOptions: show(['setVariables']),
		description: 'Comma-separated variable names. Names start with a letter and use lowercase letters, digits, and underscores.',
	},
	{
		displayName: 'Account IDs',
		name: 'accountIds',
		type: 'string',
		default: '',
		required: true,
		displayOptions: show(['setSenderAccounts']),
		description: 'Comma-separated sender account UUIDs',
	},
	{
		displayName: 'Email',
		name: 'emailAddress',
		type: 'string',
		default: '',
		placeholder: 'e.g. alex@example.com',
		displayOptions: show(['createPerson']),
		description: 'Person email. Omit when the address is not known yet.',
	},
	{
		displayName: 'Variables',
		name: 'personVariables',
		type: 'json',
		default: '{}',
		displayOptions: show(['createPerson']),
		description: 'Declared campaign variables as a JSON object of strings',
	},
	{
		displayName: 'Event Type',
		name: 'eventType',
		type: 'options',
		options: [
			{ name: 'Email Clicked', value: 'EMAIL.CLICKED' },
			{ name: 'Email Opened', value: 'EMAIL.OPENED' },
			{ name: 'Email Replied', value: 'EMAIL.REPLIED' },
		],
		default: 'EMAIL.REPLIED',
		displayOptions: show(['createSequence']),
	},
	{
		displayName: 'SRL Expression',
		name: 'srlExpression',
		type: 'string',
		default: '',
		required: true,
		displayOptions: show(['createSequence']),
		description: 'Trigger predicate',
	},
	{
		displayName: 'Priority',
		name: 'priority',
		type: 'number',
		default: 0,
		displayOptions: show(['createSequence']),
	},
	{
		displayName: 'Entry Delay (Seconds)',
		name: 'entryDelaySeconds',
		type: 'number',
		default: 0,
		displayOptions: show(['createSequence']),
	},
	{
		displayName: 'Steps',
		name: 'stepsJson',
		type: 'json',
		default: '[]',
		displayOptions: show(['createSequence']),
		description: 'Optional sequence steps. Position is array order. Each step has delay_seconds and variants with subject and body_document.',
	},
	{
		displayName: 'Sequence',
		name: 'sequenceJson',
		type: 'json',
		default: '{}',
		displayOptions: show(['updateSequence']),
		description: 'Replacement tree. Include display_name, trigger, and/or steps. Read-only fields from Get are ignored.',
	},
	{
		displayName: 'Update Mask',
		name: 'updateMask',
		type: 'string',
		default: '*',
		required: true,
		displayOptions: show(['updateSequence']),
		description: 'Comma-separated paths: display_name, trigger, steps, or *',
	},
];

export async function executeCampaigns(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	for (let i = 0; i < items.length; i++) {
		try {
			const operation = this.getNodeParameter('operation', i) as string;
			const response = await runCampaignOperation.call(this, operation, i);
			for (const row of asRows(response)) returnData.push({ json: row, pairedItem: { item: i } });
		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
				continue;
			}
			rethrowSaleslumenError(this, error, i);
		}
	}
	return returnData;
}

async function runCampaignOperation(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<IDataObject | IDataObject[]> {
	if (operation === 'createCampaign') {
		const credentials = await this.getCredentials('saleslumenApi');
		return (await saleslumenApiRequest.call(this, 'campaigns', {
			method: 'POST',
			path: '/v1/campaigns',
			body: {
				display_name: this.getNodeParameter('displayName', itemIndex) as string,
				organization: organizationResourceName(String(credentials.organizationId ?? '')),
				request_id: requestId(this, itemIndex),
			},
			json: true,
		}, itemIndex)) as IDataObject;
	}
	if (operation === 'getCampaign') {
		return (await saleslumenApiRequest.call(this, 'campaigns', {
			method: 'GET',
			path: `/v1/campaigns/${campaignId(this, itemIndex)}`,
			json: true,
		}, itemIndex)) as IDataObject;
	}
	if (operation === 'getManyCampaigns') {
		return await collectList.call(this, 'campaigns', itemIndex, {
			path: '/v1/campaigns',
			itemsKey: 'campaigns',
			requestTokenKey: 'page_token',
			responseTokenKey: 'next_page_token',
			query: {
				page_size: listPageSize(this, itemIndex),
				page_token: pageToken(this, itemIndex),
				visibility: this.getNodeParameter('visibility', itemIndex) as string,
			},
			returnAll: this.getNodeParameter('returnAll', itemIndex, false) as boolean,
		});
	}
	if (operation === 'updateCampaign') {
		const fields = this.getNodeParameter('updateFields', itemIndex, {}) as IDataObject;
		return (await saleslumenApiRequest.call(this, 'campaigns', {
			method: 'PATCH',
			path: `/v1/campaigns/${campaignId(this, itemIndex)}`,
			body: campaignUpdateBody(fields, etag(this, itemIndex), requestId(this, itemIndex)),
			json: true,
		}, itemIndex)) as IDataObject;
	}
	if (operation === 'deleteCampaign') {
		await saleslumenApiRequest.call(this, 'campaigns', {
			method: 'DELETE',
			path: `/v1/campaigns/${campaignId(this, itemIndex)}`,
			qs: { request_id: requestId(this, itemIndex), etag: etag(this, itemIndex) },
		}, itemIndex);
		return { deleted: true, id: campaignId(this, itemIndex) };
	}
	if (COMMANDS[operation]) {
		return (await saleslumenApiRequest.call(this, 'campaigns', {
			method: 'POST',
			path: `/v1/campaigns/${campaignId(this, itemIndex)}:${COMMANDS[operation]}`,
			body: { etag: etag(this, itemIndex), request_id: requestId(this, itemIndex) },
			json: true,
		}, itemIndex)) as IDataObject;
	}
	if (operation === 'setVariables') {
		return (await saleslumenApiRequest.call(this, 'campaigns', {
			method: 'POST',
			path: `/v1/campaigns/${campaignId(this, itemIndex)}:setVariables`,
			body: {
				variables: variableNames(this.getNodeParameter('variables', itemIndex, '') as string),
				etag: etag(this, itemIndex),
				request_id: requestId(this, itemIndex),
			},
			json: true,
		}, itemIndex)) as IDataObject;
	}
	if (operation === 'setSenderAccounts') {
		return (await saleslumenApiRequest.call(this, 'campaigns', {
			method: 'POST',
			path: `/v1/campaigns/${campaignId(this, itemIndex)}:setSenderAccounts`,
			body: {
				account_ids: uuidList(this.getNodeParameter('accountIds', itemIndex) as string, 'Account ID'),
				etag: etag(this, itemIndex),
				request_id: requestId(this, itemIndex),
			},
			json: true,
		}, itemIndex)) as IDataObject;
	}
	if (operation === 'createPerson') {
		const email = (this.getNodeParameter('emailAddress', itemIndex, '') as string).trim();
		const body: IDataObject = {
			variables: stringMap(this.getNodeParameter('personVariables', itemIndex, '{}'), 'Variables'),
			request_id: requestId(this, itemIndex),
		};
		if (email) body.email_address = email;
		return (await saleslumenApiRequest.call(this, 'campaigns', {
			method: 'POST',
			path: `/v1/campaigns/${campaignId(this, itemIndex)}/people`,
			body,
			json: true,
		}, itemIndex)) as IDataObject;
	}
	if (operation === 'getManySequences') {
		return await collectList.call(this, 'campaigns', itemIndex, {
			path: `/v1/campaigns/${campaignId(this, itemIndex)}/sequences`,
			itemsKey: 'sequences',
			requestTokenKey: 'page_token',
			responseTokenKey: 'next_page_token',
			query: { page_size: listPageSize(this, itemIndex), page_token: pageToken(this, itemIndex) },
			returnAll: this.getNodeParameter('returnAll', itemIndex, false) as boolean,
		});
	}
	if (operation === 'getSequence') {
		return (await saleslumenApiRequest.call(this, 'campaigns', {
			method: 'GET',
			path: `/v1/campaigns/${campaignId(this, itemIndex)}/sequences/${sequenceId(this, itemIndex)}`,
			json: true,
		}, itemIndex)) as IDataObject;
	}
	if (operation === 'createSequence') {
		const body: IDataObject = {
			display_name: this.getNodeParameter('displayName', itemIndex) as string,
			trigger: sequenceTrigger({
				eventType: this.getNodeParameter('eventType', itemIndex) as string,
				srlExpression: this.getNodeParameter('srlExpression', itemIndex) as string,
				priority: this.getNodeParameter('priority', itemIndex) as number,
				entryDelaySeconds: this.getNodeParameter('entryDelaySeconds', itemIndex) as number,
			}),
			request_id: requestId(this, itemIndex),
		};
		const steps = optionalSteps(this.getNodeParameter('stepsJson', itemIndex, '[]'));
		if (steps) body.steps = steps;
		return (await saleslumenApiRequest.call(this, 'campaigns', {
			method: 'POST',
			path: `/v1/campaigns/${campaignId(this, itemIndex)}/sequences`,
			body,
			json: true,
		}, itemIndex)) as IDataObject;
	}
	if (operation === 'updateSequence') {
		const mask = (this.getNodeParameter('updateMask', itemIndex) as string).trim();
		if (!mask) throw new ContractError('Update Mask is required');
		return (await saleslumenApiRequest.call(this, 'campaigns', {
			method: 'PATCH',
			path: `/v1/campaigns/${campaignId(this, itemIndex)}/sequences/${sequenceId(this, itemIndex)}`,
			body: {
				sequence: sequencePayload(this.getNodeParameter('sequenceJson', itemIndex)),
				update_mask: mask,
				etag: etag(this, itemIndex),
				request_id: requestId(this, itemIndex),
			},
			json: true,
		}, itemIndex)) as IDataObject;
	}
	if (operation === 'deleteSequence') {
		const id = sequenceId(this, itemIndex);
		await saleslumenApiRequest.call(this, 'campaigns', {
			method: 'DELETE',
			path: `/v1/campaigns/${campaignId(this, itemIndex)}/sequences/${id}`,
			qs: { request_id: requestId(this, itemIndex), etag: etag(this, itemIndex) },
		}, itemIndex);
		return { deleted: true, id };
	}
	throw new NodeOperationError(this.getNode(), `Unsupported Campaigns operation '${operation}'`, { itemIndex });
}

function asRows(response: IDataObject | IDataObject[]): IDataObject[] {
	return Array.isArray(response) ? response : [response];
}

function campaignId(ctx: IExecuteFunctions, itemIndex: number): string {
	return requireUuid(ctx.getNodeParameter('campaignId', itemIndex) as string, 'Campaign ID');
}

function sequenceId(ctx: IExecuteFunctions, itemIndex: number): string {
	return requireUuid(ctx.getNodeParameter('sequenceId', itemIndex) as string, 'Sequence ID');
}

function etag(ctx: IExecuteFunctions, itemIndex: number): string {
	const value = (ctx.getNodeParameter('etag', itemIndex) as string).trim();
	if (!value) throw new ContractError('Etag is required');
	return value;
}

function requestId(ctx: IExecuteFunctions, itemIndex: number): string {
	return resolveRequestId(ctx.getNodeParameter('requestId', itemIndex, '') as string);
}

function listPageSize(ctx: IExecuteFunctions, itemIndex: number): number {
	if (ctx.getNodeParameter('returnAll', itemIndex, false) as boolean) return 200;
	return pageSize(ctx.getNodeParameter('pageSize', itemIndex, 50) as number);
}

function pageToken(ctx: IExecuteFunctions, itemIndex: number): string {
	if (ctx.getNodeParameter('returnAll', itemIndex, false) as boolean) return '';
	return (ctx.getNodeParameter('pageCursor', itemIndex, '') as string).trim();
}
