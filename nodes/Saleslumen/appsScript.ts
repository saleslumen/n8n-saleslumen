import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { saleslumenApiRequest } from '../shared/transport';

export const appsScriptProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['appsScript'] } },
		options: [
			{
				name: 'Create Project',
				value: 'createProject',
				action: 'Create project',
				description: 'Create a script project',
			},
			{
				name: 'Get Project',
				value: 'getProject',
				action: 'Get project',
				description: 'Get a script project by ID',
			},
			{
				name: 'Run Function',
				value: 'runFunction',
				action: 'Run function',
				description: 'Run a script function',
			},
			{
				name: 'Update Content',
				value: 'updateProjectContent',
				action: 'Update project content',
				description: 'Replace project files',
			},
		],
		default: 'createProject',
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. Hello Script',
		displayOptions: { show: { resource: ['appsScript'], operation: ['createProject'] } },
	},
	{
		displayName: 'Script ID',
		name: 'scriptId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['appsScript'],
				operation: ['getProject', 'updateProjectContent', 'runFunction'],
			},
		},
	},
	{
		displayName: 'Content',
		name: 'contentJson',
		type: 'json',
		default:
			'{\n  "files": [\n    {\n      "name": "appsscript.json",\n      "type": "JSON",\n      "source": "{\\n  \\"runtime\\": \\"nodejs22\\",\\n  \\"timeZone\\": \\"America/New_York\\",\\n  \\"dependencies\\": { \\"libraries\\": [], \\"enabledServices\\": [] }\\n}"\n    },\n    {\n      "name": "Code.js",\n      "type": "SERVER_JS",\n      "source": "function greet(name) {\\n  return \'Hello, \' + name + \'!\';\\n}\\n"\n    }\n  ]\n}',
		displayOptions: { show: { resource: ['appsScript'], operation: ['updateProjectContent'] } },
		description: 'Project content object with files array',
	},
	{
		displayName: 'Function Name',
		name: 'functionName',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. greet',
		displayOptions: { show: { resource: ['appsScript'], operation: ['runFunction'] } },
	},
	{
		displayName: 'Parameters',
		name: 'parametersJson',
		type: 'json',
		default: '[]',
		displayOptions: { show: { resource: ['appsScript'], operation: ['runFunction'] } },
		description: 'JSON array of function parameters',
	},
];

export async function executeAppsScript(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	for (let i = 0; i < items.length; i++) {
		try {
			const operation = this.getNodeParameter('operation', i) as string;
			let response: IDataObject;
			if (operation === 'createProject') {
				response = (await saleslumenApiRequest.call(
					this,
					'script',
					{
						method: 'POST',
						path: '/v1/projects',
						body: { title: this.getNodeParameter('title', i) as string },
						json: true,
					},
					i,
				)) as IDataObject;
			} else if (operation === 'getProject') {
				const scriptId = this.getNodeParameter('scriptId', i) as string;
				response = (await saleslumenApiRequest.call(
					this,
					'script',
					{ method: 'GET', path: `/v1/projects/${scriptId}`, json: true },
					i,
				)) as IDataObject;
			} else if (operation === 'updateProjectContent') {
				const scriptId = this.getNodeParameter('scriptId', i) as string;
				const content = parseJson(
					this,
					i,
					this.getNodeParameter('contentJson', i),
					'Content',
				) as IDataObject;
				response = (await saleslumenApiRequest.call(
					this,
					'script',
					{
						method: 'PUT',
						path: `/v1/projects/${scriptId}/content`,
						body: { content },
						json: true,
					},
					i,
				)) as IDataObject;
			} else if (operation === 'runFunction') {
				const scriptId = this.getNodeParameter('scriptId', i) as string;
				const functionName = this.getNodeParameter('functionName', i) as string;
				const parameters = parseJson(
					this,
					i,
					this.getNodeParameter('parametersJson', i, '[]'),
					'Parameters',
				);
				response = (await saleslumenApiRequest.call(
					this,
					'script',
					{
						method: 'POST',
						path: `/v1/scripts/${scriptId}:run`,
						body: {
							executionRequest: {
								function: functionName,
								parameters,
							},
						},
						json: true,
					},
					i,
				)) as IDataObject;
				if (response.error) {
					throw new NodeOperationError(
						this.getNode(),
						typeof response.error === 'string' ? response.error : JSON.stringify(response.error),
						{
							description:
								'Apps Script returned HTTP 200 with an Operation error. Check function logs and parameters.',
							itemIndex: i,
						},
					);
				}
			} else {
				throw new NodeOperationError(
					this.getNode(),
					`Unsupported Apps Script operation '${operation}'`,
					{ itemIndex: i },
				);
			}
			returnData.push({ json: response, pairedItem: { item: i } });
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

function parseJson(
	ctx: IExecuteFunctions,
	itemIndex: number,
	value: unknown,
	label: string,
): unknown {
	if (typeof value === 'string') {
		try {
			return JSON.parse(value);
		} catch {
			throw new NodeOperationError(ctx.getNode(), `${label} must be valid JSON`, { itemIndex });
		}
	}
	return value;
}
