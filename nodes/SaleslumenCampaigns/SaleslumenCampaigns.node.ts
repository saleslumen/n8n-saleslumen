import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { saleslumenApiRequest } from '../shared/transport';

export class SaleslumenCampaigns implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Saleslumen Campaigns',
		name: 'saleslumenCampaigns',
		icon: { light: 'file:product.svg', dark: 'file:product.dark.svg' },
		group: ['transform'],
		version: [1],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Manage Saleslumen outbound campaigns',
		defaults: { name: 'Saleslumen Campaigns' },
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
				options: [
					{ name: 'Campaign', value: 'campaign' },
					{ name: 'Person', value: 'person' },
				],
				default: 'campaign',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['campaign'] } },
				options: [
					{ name: 'Create', value: 'create', action: 'Create campaign', description: 'Create a campaign' },
					{ name: 'Get', value: 'get', action: 'Get campaign', description: 'Get a campaign by ID' },
					{ name: 'Get Many', value: 'getAll', action: 'Get many campaigns', description: 'List campaigns' },
					{ name: 'Update', value: 'update', action: 'Update campaign', description: 'Update a campaign' },
				],
				default: 'create',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['person'] } },
				options: [
					{ name: 'Enroll', value: 'enroll', action: 'Enroll person', description: 'Enroll a person in a campaign' },
				],
				default: 'enroll',
			},
			{
				displayName: 'Campaign ID',
				name: 'campaignId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['campaign', 'person'],
						operation: ['get', 'update', 'enroll'],
					},
				},
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'e.g. Outbound Q3',
				displayOptions: { show: { resource: ['campaign'], operation: ['create'] } },
			},
			{
				displayName: 'State',
				name: 'state',
				type: 'options',
				options: [
					{ name: 'Draft', value: 'DRAFT' },
					{ name: 'Active', value: 'ACTIVE' },
					{ name: 'Paused', value: 'PAUSED' },
					{ name: 'Completed', value: 'COMPLETED' },
				],
				default: 'DRAFT',
				displayOptions: { show: { resource: ['campaign'], operation: ['create'] } },
			},
			{
				displayName: 'Variables',
				name: 'variables',
				type: 'string',
				default: 'email,first_name',
				description: 'Comma-separated campaign variable names',
				displayOptions: { show: { resource: ['campaign'], operation: ['create'] } },
			},
			{
				displayName: 'Update Fields',
				name: 'updateFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['campaign'], operation: ['update'] } },
				options: [
					{ displayName: 'Name', name: 'name', type: 'string', default: '' },
					{
						displayName: 'State',
						name: 'state',
						type: 'options',
						options: [
							{ name: 'Draft', value: 'DRAFT' },
							{ name: 'Active', value: 'ACTIVE' },
							{ name: 'Paused', value: 'PAUSED' },
							{ name: 'Completed', value: 'COMPLETED' },
						],
						default: 'DRAFT',
					},
					{
						displayName: 'Stop on Reply',
						name: 'stop_on_reply',
						type: 'boolean',
						default: true,
					},
					{ displayName: 'Track Clicks', name: 'track_clicks', type: 'boolean', default: true },
					{ displayName: 'Track Opens', name: 'track_opens', type: 'boolean', default: true },
				],
			},
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'e.g. alex@example.com',
				displayOptions: { show: { resource: ['person'], operation: ['enroll'] } },
			},
			{
				displayName: 'First Name',
				name: 'firstName',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['person'], operation: ['enroll'] } },
			},
			{
				displayName: 'Person State',
				name: 'personState',
				type: 'options',
				options: [
					{ name: 'Not Started', value: 'NOT_STARTED' },
					{ name: 'Active', value: 'ACTIVE' },
					{ name: 'Paused', value: 'PAUSED' },
					{ name: 'Completed', value: 'COMPLETED' },
				],
				default: 'NOT_STARTED',
				displayOptions: { show: { resource: ['person'], operation: ['enroll'] } },
			},
			{
				displayName: 'Additional Variables',
				name: 'additionalVariables',
				type: 'json',
				default: '{}',
				displayOptions: { show: { resource: ['person'], operation: ['enroll'] } },
				description: 'Extra person variables as JSON object',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				let response: IDataObject | IDataObject[];
				if (resource === 'campaign' && operation === 'create') {
					const variablesRaw = this.getNodeParameter('variables', i, '') as string;
					const variables = variablesRaw
						.split(',')
						.map((v) => v.trim())
						.filter(Boolean);
					response = (await saleslumenApiRequest.call(
						this,
						'campaigns',
						{
							method: 'POST',
							path: '/v1/',
							body: {
								name: this.getNodeParameter('name', i) as string,
								state: this.getNodeParameter('state', i) as string,
								variables,
								stop_on_reply: true,
								track_opens: true,
								track_clicks: true,
							},
							json: true,
						},
						i,
					)) as IDataObject;
				} else if (resource === 'campaign' && operation === 'get') {
					const campaignId = this.getNodeParameter('campaignId', i) as string;
					response = (await saleslumenApiRequest.call(
						this,
						'campaigns',
						{ method: 'GET', path: `/v1/${campaignId}`, json: true },
						i,
					)) as IDataObject;
				} else if (resource === 'campaign' && operation === 'getAll') {
					response = (await saleslumenApiRequest.call(
						this,
						'campaigns',
						{ method: 'GET', path: '/v1/', json: true },
						i,
					)) as IDataObject[];
				} else if (resource === 'campaign' && operation === 'update') {
					const campaignId = this.getNodeParameter('campaignId', i) as string;
					const updateFields = this.getNodeParameter('updateFields', i, {}) as IDataObject;
					if (Object.keys(updateFields).length === 0) {
						throw new NodeOperationError(this.getNode(), 'Add at least one update field', {
							itemIndex: i,
						});
					}
					response = (await saleslumenApiRequest.call(
						this,
						'campaigns',
						{
							method: 'PATCH',
							path: `/v1/${campaignId}`,
							body: updateFields,
							json: true,
						},
						i,
					)) as IDataObject;
				} else if (resource === 'person' && operation === 'enroll') {
					const campaignId = this.getNodeParameter('campaignId', i) as string;
					const email = this.getNodeParameter('email', i) as string;
					const firstName = this.getNodeParameter('firstName', i, '') as string;
					const personState = this.getNodeParameter('personState', i) as string;
					let extra: IDataObject = {};
					const raw = this.getNodeParameter('additionalVariables', i, '{}') as string | IDataObject;
					if (typeof raw === 'string') {
						try {
							extra = raw ? (JSON.parse(raw) as IDataObject) : {};
						} catch {
							throw new NodeOperationError(this.getNode(), 'Additional Variables must be valid JSON', {
								itemIndex: i,
							});
						}
					} else {
						extra = raw;
					}
					const variables: IDataObject = { ...extra, email };
					if (firstName) variables.first_name = firstName;
					response = (await saleslumenApiRequest.call(
						this,
						'campaigns',
						{
							method: 'POST',
							path: `/v1/${campaignId}/people`,
							body: { variables, state: personState },
							json: true,
						},
						i,
					)) as IDataObject;
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported resource/operation ${resource}/${operation}`,
						{ itemIndex: i },
					);
				}
				const list = Array.isArray(response) ? response : [response];
				for (const row of list) {
					returnData.push({ json: row as IDataObject, pairedItem: { item: i } });
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
		return [returnData];
	}
}
