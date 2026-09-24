import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ContractError, jsonValue, pageSize, requireUuid } from '../shared/contract';
import { assertUserAccessToken, collectList, rethrowSaleslumenError, saleslumenApiRequest } from '../shared/transport';

const DEFAULT_NODES = [
	{ id: 'start', type: 1, start: {} },
	{ id: 'end', type: 2, end: { reason: 'done' } },
];
const DEFAULT_CONNECTIONS = [{ from: 'start', to: 'end', type: 0 }];

const WORKFLOW_ID_OPS = [
	'activateWorkflow',
	'cancelExecution',
	'deactivateWorkflow',
	'getExecution',
	'getManyExecutions',
	'getWorkflow',
	'publishWorkflow',
	'resumeExecution',
	'startExecution',
	'updateWorkflow',
];

function show(operation: string[]): INodeProperties['displayOptions'] {
	return { show: { resource: ['workflows'], operation } };
}

export const workflowsProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['workflows'] } },
		options: [
			{ name: 'Activate', value: 'activateWorkflow', action: 'Activate a workflow', description: 'Serve the published workflow version' },
			{ name: 'Cancel Execution', value: 'cancelExecution', action: 'Cancel an execution', description: 'Cancel an active or paused execution' },
			{ name: 'Create', value: 'createWorkflow', action: 'Create a workflow', description: 'Create an unpublished draft workflow' },
			{ name: 'Deactivate', value: 'deactivateWorkflow', action: 'Deactivate a workflow', description: 'Stop serving the published workflow' },
			{ name: 'Get', value: 'getWorkflow', action: 'Get a workflow', description: 'Get a workflow by ID' },
			{ name: 'Get Execution', value: 'getExecution', action: 'Get an execution', description: 'Get an execution by ID' },
			{ name: 'Get Many', value: 'getManyWorkflows', action: 'Get many workflows', description: 'List workflows' },
			{ name: 'Get Many Executions', value: 'getManyExecutions', action: 'Get many executions', description: 'List executions' },
			{ name: 'Publish', value: 'publishWorkflow', action: 'Publish a workflow', description: 'Publish the latest draft without activating it' },
			{ name: 'Resume Execution', value: 'resumeExecution', action: 'Resume an execution', description: 'Resume a paused execution. Requires an access token.' },
			{ name: 'Start Execution', value: 'startExecution', action: 'Start an execution', description: 'Start an execution. Requires an access token.' },
			{ name: 'Update', value: 'updateWorkflow', action: 'Update a workflow', description: 'Append a draft version' },
		],
		default: 'createWorkflow',
	},
	{
		displayName: 'Workflow ID',
		name: 'workflowId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: show(WORKFLOW_ID_OPS),
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		placeholder: 'e.g. hello',
		displayOptions: show(['createWorkflow', 'updateWorkflow']),
		description: 'Workflow name. Required when creating. On update, leave empty to keep the current name.',
	},
	{
		displayName: 'Nodes',
		name: 'nodesJson',
		type: 'json',
		default: JSON.stringify(DEFAULT_NODES, null, 2),
		displayOptions: show(['createWorkflow', 'updateWorkflow']),
		description: 'Workflow nodes JSON array. Start is type 1 and end is type 2.',
	},
	{
		displayName: 'Connections',
		name: 'connectionsJson',
		type: 'json',
		default: JSON.stringify(DEFAULT_CONNECTIONS, null, 2),
		displayOptions: show(['createWorkflow', 'updateWorkflow']),
		description: 'Workflow connections JSON array. Type 0 is the main flow.',
	},
	{
		displayName: 'Execution ID',
		name: 'executionId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: show(['cancelExecution', 'getExecution', 'resumeExecution']),
	},
	{
		displayName: 'Input',
		name: 'inputJson',
		type: 'json',
		default: '{}',
		displayOptions: show(['resumeExecution', 'startExecution']),
		description: 'Execution variables as a JSON object',
	},
	{
		displayName: 'Version ID',
		name: 'versionId',
		type: 'string',
		default: '',
		displayOptions: show(['startExecution']),
		description: 'Optional version UUID. Set it to preview a draft. Omit it to run the published active workflow.',
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
			const response = await runWorkflowOperation.call(this, operation, i);
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

async function runWorkflowOperation(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<IDataObject | IDataObject[]> {
	if (operation === 'createWorkflow') {
		const name = (this.getNodeParameter('name', itemIndex) as string).trim();
		if (!name) throw new ContractError('Name is required');
		return unwrap((await saleslumenApiRequest.call(this, 'workflows', {
			method: 'POST',
			path: '/v1/workflows',
			body: { name, nodes: jsonArray(this, itemIndex, 'nodesJson', 'Nodes'), connections: jsonArray(this, itemIndex, 'connectionsJson', 'Connections') },
			json: true,
		}, itemIndex)) as IDataObject);
	}
	if (operation === 'updateWorkflow') {
		const body: IDataObject = {
			nodes: jsonArray(this, itemIndex, 'nodesJson', 'Nodes'),
			connections: jsonArray(this, itemIndex, 'connectionsJson', 'Connections'),
		};
		const name = (this.getNodeParameter('name', itemIndex, '') as string).trim();
		if (name) body.name = name;
		return unwrap((await saleslumenApiRequest.call(this, 'workflows', {
			method: 'PUT',
			path: `/v1/workflows/${workflowId(this, itemIndex)}`,
			body,
			json: true,
		}, itemIndex)) as IDataObject);
	}
	if (operation === 'getWorkflow') {
		return unwrap((await saleslumenApiRequest.call(this, 'workflows', {
			method: 'GET',
			path: `/v1/workflows/${workflowId(this, itemIndex)}`,
			json: true,
		}, itemIndex)) as IDataObject);
	}
	if (operation === 'getManyWorkflows') {
		return await collectList.call(this, 'workflows', itemIndex, {
			path: '/v1/workflows',
			itemsKey: 'workflows',
			requestTokenKey: 'pageToken',
			responseTokenKey: 'nextPageToken',
			query: listQuery(this, itemIndex),
			returnAll: this.getNodeParameter('returnAll', itemIndex, false) as boolean,
		});
	}
	if (operation === 'publishWorkflow' || operation === 'activateWorkflow' || operation === 'deactivateWorkflow') {
		const command = operation === 'publishWorkflow' ? 'publish' : operation === 'activateWorkflow' ? 'activate' : 'deactivate';
		return unwrap((await saleslumenApiRequest.call(this, 'workflows', {
			method: 'POST',
			path: `/v1/workflows/${workflowId(this, itemIndex)}:${command}`,
			body: {},
			json: true,
		}, itemIndex)) as IDataObject);
	}
	if (operation === 'startExecution' || operation === 'resumeExecution') {
		await assertUserAccessToken.call(this, itemIndex);
		const input = jsonObject(this, itemIndex, 'inputJson', 'Input');
		if (operation === 'startExecution') {
			const versionId = (this.getNodeParameter('versionId', itemIndex, '') as string).trim();
			const body: IDataObject = { input };
			if (versionId) body.versionId = requireUuid(versionId, 'Version ID');
			return unwrap((await saleslumenApiRequest.call(this, 'workflows', {
				method: 'POST',
				path: `/v1/workflows/${workflowId(this, itemIndex)}/executions:start`,
				body,
				json: true,
			}, itemIndex)) as IDataObject);
		}
		return unwrap((await saleslumenApiRequest.call(this, 'workflows', {
			method: 'POST',
			path: `/v1/workflows/${workflowId(this, itemIndex)}/executions/${executionId(this, itemIndex)}:resume`,
			body: { input },
			json: true,
		}, itemIndex)) as IDataObject);
	}
	if (operation === 'cancelExecution') {
		return unwrap((await saleslumenApiRequest.call(this, 'workflows', {
			method: 'POST',
			path: `/v1/workflows/${workflowId(this, itemIndex)}/executions/${executionId(this, itemIndex)}:cancel`,
			body: {},
			json: true,
		}, itemIndex)) as IDataObject);
	}
	if (operation === 'getExecution') {
		return unwrap((await saleslumenApiRequest.call(this, 'workflows', {
			method: 'GET',
			path: `/v1/workflows/${workflowId(this, itemIndex)}/executions/${executionId(this, itemIndex)}`,
			json: true,
		}, itemIndex)) as IDataObject);
	}
	if (operation === 'getManyExecutions') {
		return await collectList.call(this, 'workflows', itemIndex, {
			path: `/v1/workflows/${workflowId(this, itemIndex)}/executions`,
			itemsKey: 'executions',
			requestTokenKey: 'pageToken',
			responseTokenKey: 'nextPageToken',
			query: listQuery(this, itemIndex),
			returnAll: this.getNodeParameter('returnAll', itemIndex, false) as boolean,
		});
	}
	throw new NodeOperationError(this.getNode(), `Unsupported Workflows operation '${operation}'`, { itemIndex });
}

function asRows(response: IDataObject | IDataObject[]): IDataObject[] {
	return Array.isArray(response) ? response : [response];
}

function unwrap(response: IDataObject): IDataObject {
	if (response.workflow && typeof response.workflow === 'object') return response.workflow as IDataObject;
	if (response.execution && typeof response.execution === 'object') return response.execution as IDataObject;
	return response;
}

function workflowId(ctx: IExecuteFunctions, itemIndex: number): string {
	return requireUuid(ctx.getNodeParameter('workflowId', itemIndex) as string, 'Workflow ID');
}

function executionId(ctx: IExecuteFunctions, itemIndex: number): string {
	return requireUuid(ctx.getNodeParameter('executionId', itemIndex) as string, 'Execution ID');
}

function jsonArray(ctx: IExecuteFunctions, itemIndex: number, name: string, label: string): unknown[] {
	const parsed = jsonValue(ctx.getNodeParameter(name, itemIndex), label);
	if (!Array.isArray(parsed)) throw new ContractError(`${label} must be a JSON array`);
	return parsed;
}

function jsonObject(ctx: IExecuteFunctions, itemIndex: number, name: string, label: string): IDataObject {
	const parsed = jsonValue(ctx.getNodeParameter(name, itemIndex, '{}'), label);
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new ContractError(`${label} must be a JSON object`);
	return parsed as IDataObject;
}

function listQuery(ctx: IExecuteFunctions, itemIndex: number): IDataObject {
	const returnAll = ctx.getNodeParameter('returnAll', itemIndex, false) as boolean;
	return {
		pageSize: returnAll ? 50 : pageSize(ctx.getNodeParameter('pageSize', itemIndex, 50) as number),
		pageToken: returnAll ? '' : (ctx.getNodeParameter('pageCursor', itemIndex, '') as string).trim(),
	};
}
