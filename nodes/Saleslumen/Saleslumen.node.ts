import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { listProperties } from '../shared/list';
import { appsScriptProperties, executeAppsScript } from './appsScript';
import { campaignsProperties, executeCampaigns } from './campaigns';
import { emailsProperties, executeEmails } from './emails';
import { executeWorkflows, workflowsProperties } from './workflows';

export class Saleslumen implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Saleslumen',
		name: 'saleslumen',
		icon: {
			light: 'file:../../icons/saleslumen.svg',
			dark: 'file:../../icons/saleslumen.dark.svg',
		},
		group: ['transform'],
		version: 2,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description: 'Discover emails and manage Saleslumen campaigns, workflows, and scripts',
		defaults: { name: 'Saleslumen' },
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
					{ name: 'Apps Script', value: 'appsScript' },
					{ name: 'Campaign', value: 'campaigns' },
					{ name: 'Email', value: 'emails' },
					{ name: 'Workflow', value: 'workflows' },
				],
				default: 'emails',
			},
			...appsScriptProperties,
			...campaignsProperties,
			...emailsProperties,
			...workflowsProperties,
			...listProperties,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		if (resource === 'appsScript') return [await executeAppsScript.call(this, items)];
		if (resource === 'campaigns') return [await executeCampaigns.call(this, items)];
		if (resource === 'emails') return [await executeEmails.call(this, items, operation)];
		if (resource === 'workflows') return [await executeWorkflows.call(this, items)];
		throw new NodeOperationError(this.getNode(), `Unsupported resource '${resource}'`);
	}
}
