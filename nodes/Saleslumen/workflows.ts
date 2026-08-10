import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { saleslumenApiRequest } from '../shared/transport';

const DEFAULT_NODES = [
	{ id: 'start', type: 1, start: {} },
	{ id: 'end', type: 2, end: { reason: 'done' } },
];
const DEFAULT_CONNECTIONS = [{ from: 'start', to: 'end', type: 0 }];

export const workflowsProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['workflows'] } },
		options: [
			{
				name: 'Create Workflow',
				value: 'createWorkflow',
				action: 'Create workflow',
				description: 'Create a workflow',
			},
			{
				name: 'Get Execution',
				value: 'getExecution',
				action: 'Get execution',
				description: 'Get an execution by ID',
			},
			{
				name: 'Get Many Workflows',
				value: 'getManyWorkflows',
				action: 'Get many workflows',
				description: 'List workflows',
			},
			{
				name: 'Get Workflow',
				value: 'getWorkflow',
				action: 'Get workflow',
				description: 'Get a workflow by ID',
			},
			{
				name: 'Start Execution',
				value: 'startExecution',
				action: 'Start execution',
				description: 'Start a workflow execution',
			},
		],
		default: 'createWorkflow',
	},
	{
		displayName: 'Workflow ID',
		name: 'workflowId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['workflows'],
				operation: ['getExecution', 'getWorkflow', 'startExecution'],
			},
		},
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. hello',
		displayOptions: { show: { resource: ['workflows'], operation: ['createWorkflow'] } },
	},
	{
		displayName: 'Nodes',
		name: 'nodesJson',
		type: 'json',
		default: JSON.stringify(DEFAULT_NODES, null, 2),
		displayOptions: { show: { resource: ['workflows'], operation: ['createWorkflow'] } },
		description: 'Workflow nodes JSON array',
	},
	{
		displayName: 'Connections',
		name: 'connectionsJson',
		type: 'json',
		default: JSON.stringify(DEFAULT_CONNECTIONS, null, 2),
		displayOptions: { show: { resource: ['workflows'], operation: ['createWorkflow'] } },
		description: 'Workflow connections JSON array',
	},
	{
		displayName: 'Execution ID',
		name: 'executionId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['workflows'], operation: ['getExecution'] } },
	},
	{
		displayName: 'Input',
		name: 'inputJson',
		type: 'json',
		default: '{}',
		displayOptions: { show: { resource: ['workflows'], operation: ['startExecution'] } },
		description: 'Initial execution variables as JSON object',
	},
	{
		displayName: 'Version ID',
		name: 'versionId',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['workflows'], operation: ['startExecution'] } },
		description: 'Optional published version UUID to pin',
	},
];

export async function executeWorkflows(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	for (let i = 0; i < items.length; i++) {
		try {
			const operation = this.getNodeParameter('operation', i) as string;
			let response: IDataObject;
			if (operation === 'createWorkflow') {
				const nodes = parseJsonParam(this, i, this.getNodeParameter('nodesJson', i), 'Nodes');
				const connections = parseJsonParam(
					this,
					i,
					this.getNodeParameter('connectionsJson', i),
					'Connections',
				);
				response = (await saleslumenApiRequest.call(
					this,
					'workflows',
					{
						method: 'POST',
						path: '/v1/workflows',
						body: {
							name: this.getNodeParameter('name', i) as string,
							nodes,
							connections,
						},
						json: true,
					},
					i,
				)) as IDataObject;
			} else if (operation === 'getWorkflow') {
				const workflowId = this.getNodeParameter('workflowId', i) as string;
				response = (await saleslumenApiRequest.call(
					this,
					'workflows',
					{ method: 'GET', path: `/v1/workflows/${workflowId}`, json: true },
					i,
				)) as IDataObject;
			} else if (operation === 'getManyWorkflows') {
				response = (await saleslumenApiRequest.call(
					this,
					'workflows',
					{ method: 'GET', path: '/v1/workflows', json: true },
					i,
				)) as IDataObject;
			} else if (operation === 'startExecution') {
				const workflowId = this.getNodeParameter('workflowId', i) as string;
				const input = parseJsonParam(
					this,
					i,
					this.getNodeParameter('inputJson', i, '{}'),
					'Input',
				) as IDataObject;
				const versionId = (this.getNodeParameter('versionId', i, '') as string).trim();
				const body: IDataObject = { input };
				if (versionId) body.versionId = versionId;
				response = (await saleslumenApiRequest.call(
					this,
					'workflows',
					{
						method: 'POST',
						path: `/v1/workflows/${workflowId}/executions:start`,
						body,
						json: true,
					},
					i,
				)) as IDataObject;
			} else if (operation === 'getExecution') {
				const workflowId = this.getNodeParameter('workflowId', i) as string;
				const executionId = this.getNodeParameter('executionId', i) as string;
				response = (await saleslumenApiRequest.call(
					this,
					'workflows',
					{
						method: 'GET',
						path: `/v1/workflows/${workflowId}/executions/${executionId}`,
						json: true,
					},
					i,
				)) as IDataObject;
			} else {
				throw new NodeOperationError(
					this.getNode(),
					`Unsupported Workflows operation '${operation}'`,
					{ itemIndex: i },
				);
			}
			const rows = unwrapList(response);
			for (const row of rows) {
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

function parseJsonParam(
	ctx: IExecuteFunctions,
	itemIndex: number,
	value: unknown,
	label: string,
): unknown {
	if (typeof value === 'string') {
		try {
			return JSON.parse(value || (label === 'Input' ? '{}' : '[]'));
		} catch {
			throw new NodeOperationError(ctx.getNode(), `${label} must be valid JSON`, { itemIndex });
		}
	}
	return value;
}

function unwrapList(response: IDataObject): IDataObject[] {
	if (Array.isArray(response)) return response as IDataObject[];
	if (Array.isArray(response.workflows)) return response.workflows as IDataObject[];
	if (response.workflow) return [response.workflow as IDataObject];
	if (response.execution) return [response.execution as IDataObject];
	return [response];
}
