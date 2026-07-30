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
		description: 'Manage Saleslumen outbound campaigns, sequences, and steps',
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
					{ name: 'Sequence', value: 'sequence' },
					{ name: 'Step', value: 'step' },
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
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['sequence'] } },
				options: [
					{ name: 'Create', value: 'create', action: 'Create sequence', description: 'Create a sequence' },
					{ name: 'Delete', value: 'delete', action: 'Delete sequence', description: 'Delete a sequence' },
					{ name: 'Get', value: 'get', action: 'Get sequence', description: 'Get a sequence by ID' },
					{ name: 'Get Many', value: 'getAll', action: 'Get many sequences', description: 'List sequences' },
					{
						name: 'Reorder Steps',
						value: 'reorderSteps',
						action: 'Reorder sequence steps',
						description: 'Move a step within a sequence',
					},
					{ name: 'Update', value: 'update', action: 'Update sequence', description: 'Update a sequence' },
				],
				default: 'create',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['step'] } },
				options: [
					{ name: 'Create', value: 'create', action: 'Create step', description: 'Create an email step' },
					{ name: 'Delete', value: 'delete', action: 'Archive step', description: 'Archive a step' },
					{ name: 'Get', value: 'get', action: 'Get step', description: 'Get a step by ID' },
					{ name: 'Get Many', value: 'getAll', action: 'Get many steps', description: 'List steps' },
					{ name: 'Update', value: 'update', action: 'Update step', description: 'Update a step' },
				],
				default: 'create',
			},
			{
				displayName: 'Campaign ID',
				name: 'campaignId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['campaign', 'person', 'sequence', 'step'],
						operation: [
							'get',
							'update',
							'enroll',
							'create',
							'getAll',
							'delete',
							'reorderSteps',
						],
					},
					hide: {
						resource: ['campaign'],
						operation: ['create', 'getAll'],
					},
				},
			},
			{
				displayName: 'Sequence ID',
				name: 'sequenceId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['sequence', 'step'],
						operation: ['get', 'update', 'delete', 'reorderSteps', 'create', 'getAll'],
					},
					hide: {
						resource: ['sequence'],
						operation: ['create', 'getAll'],
					},
				},
			},
			{
				displayName: 'Step ID',
				name: 'stepId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { resource: ['step'], operation: ['get', 'update', 'delete'] },
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
			{
				displayName: 'Name',
				name: 'sequenceName',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'e.g. Primary',
				displayOptions: { show: { resource: ['sequence'], operation: ['create'] } },
			},
			{
				displayName: 'Step Index',
				name: 'sequenceStepIndex',
				type: 'number',
				default: 0,
				required: true,
				description: 'Order index among sequences',
				displayOptions: { show: { resource: ['sequence'], operation: ['create'] } },
			},
			{
				displayName: 'Additional Fields',
				name: 'sequenceAdditionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['sequence'], operation: ['create'] } },
				options: [
					{ displayName: 'Description', name: 'description', type: 'string', default: '' },
					{ displayName: 'Condition', name: 'condition', type: 'string', default: '' },
				],
			},
			{
				displayName: 'Update Fields',
				name: 'sequenceUpdateFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['sequence'], operation: ['update'] } },
				options: [
					{ displayName: 'Name', name: 'name', type: 'string', default: '' },
					{ displayName: 'Description', name: 'description', type: 'string', default: '' },
					{ displayName: 'Condition', name: 'condition', type: 'string', default: '' },
					{ displayName: 'Step Index', name: 'step_index', type: 'number', default: 0 },
				],
			},
			{
				displayName: 'Old Index',
				name: 'oldIndex',
				type: 'number',
				default: 0,
				required: true,
				description: 'Current step position (at least one of Old/New Index must be non-zero)',
				displayOptions: { show: { resource: ['sequence'], operation: ['reorderSteps'] } },
			},
			{
				displayName: 'New Index',
				name: 'newIndex',
				type: 'number',
				default: 0,
				required: true,
				description: 'Target step position',
				displayOptions: { show: { resource: ['sequence'], operation: ['reorderSteps'] } },
			},
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'e.g. Hello {{first_name}}',
				displayOptions: { show: { resource: ['step'], operation: ['create'] } },
			},
			{
				displayName: 'Content',
				name: 'content',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				placeholder: 'e.g. Quick note for {{email}}.',
				displayOptions: { show: { resource: ['step'], operation: ['create'] } },
			},
			{
				displayName: 'Additional Fields',
				name: 'stepAdditionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['step'], operation: ['create'] } },
				options: [
					{ displayName: 'Step Index', name: 'step_index', type: 'number', default: 0 },
					{ displayName: 'Variant Index', name: 'variant_index', type: 'number', default: 0 },
					{
						displayName: 'State',
						name: 'state',
						type: 'options',
						options: [
							{ name: 'Active', value: 'ACTIVE' },
							{ name: 'Paused', value: 'PAUSED' },
							{ name: 'Archived', value: 'ARCHIVED' },
						],
						default: 'ACTIVE',
					},
				],
			},
			{
				displayName: 'Update Fields',
				name: 'stepUpdateFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['step'], operation: ['update'] } },
				options: [
					{
						displayName: 'Content',
						name: 'content',
						type: 'string',
						typeOptions: { rows: 4 },
						default: '',
					},
					{
						displayName: 'State',
						name: 'state',
						type: 'options',
						options: [
							{ name: 'Active', value: 'ACTIVE' },
							{ name: 'Paused', value: 'PAUSED' },
							{ name: 'Archived', value: 'ARCHIVED' },
						],
						default: 'ACTIVE',
					},
					{ displayName: 'Step Index', name: 'step_index', type: 'number', default: 0 },
					{ displayName: 'Subject', name: 'subject', type: 'string', default: '' },
					{ displayName: 'Variant Index', name: 'variant_index', type: 'number', default: 0 },
				],
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
				} else if (resource === 'sequence' && operation === 'create') {
					const campaignId = this.getNodeParameter('campaignId', i) as string;
					const additional = this.getNodeParameter('sequenceAdditionalFields', i, {}) as IDataObject;
					const body: IDataObject = {
						name: this.getNodeParameter('sequenceName', i) as string,
						step_index: this.getNodeParameter('sequenceStepIndex', i) as number,
						...additional,
					};
					response = (await saleslumenApiRequest.call(
						this,
						'campaigns',
						{ method: 'POST', path: `/v1/${campaignId}/sequences`, body, json: true },
						i,
					)) as IDataObject;
				} else if (resource === 'sequence' && operation === 'get') {
					const campaignId = this.getNodeParameter('campaignId', i) as string;
					const sequenceId = this.getNodeParameter('sequenceId', i) as string;
					response = (await saleslumenApiRequest.call(
						this,
						'campaigns',
						{ method: 'GET', path: `/v1/${campaignId}/sequences/${sequenceId}`, json: true },
						i,
					)) as IDataObject;
				} else if (resource === 'sequence' && operation === 'getAll') {
					const campaignId = this.getNodeParameter('campaignId', i) as string;
					response = (await saleslumenApiRequest.call(
						this,
						'campaigns',
						{ method: 'GET', path: `/v1/${campaignId}/sequences`, json: true },
						i,
					)) as IDataObject[];
				} else if (resource === 'sequence' && operation === 'update') {
					const campaignId = this.getNodeParameter('campaignId', i) as string;
					const sequenceId = this.getNodeParameter('sequenceId', i) as string;
					const updateFields = this.getNodeParameter('sequenceUpdateFields', i, {}) as IDataObject;
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
							path: `/v1/${campaignId}/sequences/${sequenceId}`,
							body: updateFields,
							json: true,
						},
						i,
					)) as IDataObject;
				} else if (resource === 'sequence' && operation === 'delete') {
					const campaignId = this.getNodeParameter('campaignId', i) as string;
					const sequenceId = this.getNodeParameter('sequenceId', i) as string;
					await saleslumenApiRequest.call(
						this,
						'campaigns',
						{ method: 'DELETE', path: `/v1/${campaignId}/sequences/${sequenceId}` },
						i,
					);
					response = { success: true, id: sequenceId };
				} else if (resource === 'sequence' && operation === 'reorderSteps') {
					const campaignId = this.getNodeParameter('campaignId', i) as string;
					const sequenceId = this.getNodeParameter('sequenceId', i) as string;
					const oldIndex = this.getNodeParameter('oldIndex', i) as number;
					const newIndex = this.getNodeParameter('newIndex', i) as number;
					if (oldIndex === 0 && newIndex === 0) {
						throw new NodeOperationError(
							this.getNode(),
							'At least one of Old Index or New Index must be non-zero',
							{ itemIndex: i },
						);
					}
					await saleslumenApiRequest.call(
						this,
						'campaigns',
						{
							method: 'POST',
							path: `/v1/${campaignId}/sequences/${sequenceId}:batchUpdate`,
							body: { updateStepsPosition: { oldIndex, newIndex } },
							json: true,
						},
						i,
					);
					response = { success: true, sequence_id: sequenceId, oldIndex, newIndex };
				} else if (resource === 'step' && operation === 'create') {
					const campaignId = this.getNodeParameter('campaignId', i) as string;
					const sequenceId = this.getNodeParameter('sequenceId', i) as string;
					const additional = this.getNodeParameter('stepAdditionalFields', i, {}) as IDataObject;
					const body: IDataObject = {
						subject: this.getNodeParameter('subject', i) as string,
						content: this.getNodeParameter('content', i) as string,
						type: 'EMAIL',
						...additional,
					};
					response = (await saleslumenApiRequest.call(
						this,
						'campaigns',
						{
							method: 'POST',
							path: `/v1/${campaignId}/sequences/${sequenceId}/steps`,
							body,
							json: true,
						},
						i,
					)) as IDataObject;
				} else if (resource === 'step' && operation === 'get') {
					const campaignId = this.getNodeParameter('campaignId', i) as string;
					const sequenceId = this.getNodeParameter('sequenceId', i) as string;
					const stepId = this.getNodeParameter('stepId', i) as string;
					response = (await saleslumenApiRequest.call(
						this,
						'campaigns',
						{
							method: 'GET',
							path: `/v1/${campaignId}/sequences/${sequenceId}/steps/${stepId}`,
							json: true,
						},
						i,
					)) as IDataObject;
				} else if (resource === 'step' && operation === 'getAll') {
					const campaignId = this.getNodeParameter('campaignId', i) as string;
					const sequenceId = this.getNodeParameter('sequenceId', i) as string;
					response = (await saleslumenApiRequest.call(
						this,
						'campaigns',
						{
							method: 'GET',
							path: `/v1/${campaignId}/sequences/${sequenceId}/steps`,
							json: true,
						},
						i,
					)) as IDataObject[];
				} else if (resource === 'step' && operation === 'update') {
					const campaignId = this.getNodeParameter('campaignId', i) as string;
					const sequenceId = this.getNodeParameter('sequenceId', i) as string;
					const stepId = this.getNodeParameter('stepId', i) as string;
					const updateFields = this.getNodeParameter('stepUpdateFields', i, {}) as IDataObject;
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
							path: `/v1/${campaignId}/sequences/${sequenceId}/steps/${stepId}`,
							body: updateFields,
							json: true,
						},
						i,
					)) as IDataObject;
				} else if (resource === 'step' && operation === 'delete') {
					const campaignId = this.getNodeParameter('campaignId', i) as string;
					const sequenceId = this.getNodeParameter('sequenceId', i) as string;
					const stepId = this.getNodeParameter('stepId', i) as string;
					await saleslumenApiRequest.call(
						this,
						'campaigns',
						{
							method: 'DELETE',
							path: `/v1/${campaignId}/sequences/${sequenceId}/steps/${stepId}`,
						},
						i,
					);
					response = { success: true, id: stepId };
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
