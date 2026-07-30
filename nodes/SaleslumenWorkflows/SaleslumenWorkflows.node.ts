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

const DEFAULT_NODES = [
	{ id: 'start', type: 1, start: {} },
	{ id: 'end', type: 2, end: { reason: 'done' } },
];
const DEFAULT_CONNECTIONS = [{ from: 'start', to: 'end', type: 0 }];

export class SaleslumenWorkflows implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Saleslumen Workflows',
		name: 'saleslumenWorkflows',
		icon: { light: 'file:product.svg', dark: 'file:product.dark.svg' },
		group: ['transform'],
		version: [1],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Create and run Saleslumen workflows',
		defaults: { name: 'Saleslumen Workflows' },
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
					{ name: 'Workflow', value: 'workflow' },
					{ name: 'Execution', value: 'execution' },
				],
				default: 'workflow',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['workflow'] } },
				options: [
					{ name: 'Create', value: 'create', action: 'Create workflow', description: 'Create a workflow' },
					{ name: 'Get', value: 'get', action: 'Get workflow', description: 'Get a workflow by ID' },
					{ name: 'Get Many', value: 'getAll', action: 'Get many workflows', description: 'List workflows' },
				],
				default: 'create',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['execution'] } },
				options: [
					{ name: 'Start', value: 'start', action: 'Start execution', description: 'Start a workflow execution' },
					{ name: 'Get', value: 'get', action: 'Get execution', description: 'Get an execution by ID' },
				],
				default: 'start',
			},
			{
				displayName: 'Workflow ID',
				name: 'workflowId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['workflow', 'execution'],
						operation: ['get', 'start'],
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
				displayOptions: { show: { resource: ['workflow'], operation: ['create'] } },
			},
			{
				displayName: 'Nodes',
				name: 'nodesJson',
				type: 'json',
				default: JSON.stringify(DEFAULT_NODES, null, 2),
				displayOptions: { show: { resource: ['workflow'], operation: ['create'] } },
				description: 'Workflow nodes JSON array',
			},
			{
				displayName: 'Connections',
				name: 'connectionsJson',
				type: 'json',
				default: JSON.stringify(DEFAULT_CONNECTIONS, null, 2),
				displayOptions: { show: { resource: ['workflow'], operation: ['create'] } },
				description: 'Workflow connections JSON array',
			},
			{
				displayName: 'Execution ID',
				name: 'executionId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['execution'], operation: ['get'] } },
			},
			{
				displayName: 'Input',
				name: 'inputJson',
				type: 'json',
				default: '{}',
				displayOptions: { show: { resource: ['execution'], operation: ['start'] } },
				description: 'Initial execution variables as JSON object',
			},
			{
				displayName: 'Version ID',
				name: 'versionId',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['execution'], operation: ['start'] } },
				description: 'Optional published version UUID to pin',
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
				let response: IDataObject;
				if (resource === 'workflow' && operation === 'create') {
					const nodes = parseJsonParam(this, i, this.getNodeParameter('nodesJson', i), 'Nodes');
					const connections = parseJsonParam(this, i, this.getNodeParameter('connectionsJson', i), 'Connections');
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
				} else if (resource === 'workflow' && operation === 'get') {
					const workflowId = this.getNodeParameter('workflowId', i) as string;
					response = (await saleslumenApiRequest.call(
						this,
						'workflows',
						{ method: 'GET', path: `/v1/workflows/${workflowId}`, json: true },
						i,
					)) as IDataObject;
				} else if (resource === 'workflow' && operation === 'getAll') {
					response = (await saleslumenApiRequest.call(
						this,
						'workflows',
						{ method: 'GET', path: '/v1/workflows', json: true },
						i,
					)) as IDataObject;
				} else if (resource === 'execution' && operation === 'start') {
					const workflowId = this.getNodeParameter('workflowId', i) as string;
					const input = parseJsonParam(this, i, this.getNodeParameter('inputJson', i, '{}'), 'Input') as IDataObject;
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
				} else if (resource === 'execution' && operation === 'get') {
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
						`Unsupported resource/operation ${resource}/${operation}`,
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
		return [returnData];
	}
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
