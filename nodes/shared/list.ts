import type { INodeProperties } from 'n8n-workflow';

const listShow = {
	resource: ['campaigns', 'workflows'],
	operation: ['getManyCampaigns', 'getManySequences', 'getManyWorkflows', 'getManyExecutions'],
};

export const listProperties: INodeProperties[] = [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: { show: listShow },
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Page Size',
		name: 'pageSize',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 200 },
		default: 50,
		displayOptions: { show: { ...listShow, returnAll: [false] } },
		description: 'Number of results per page. Maximum 200.',
	},
	{
		displayName: 'Page Cursor',
		name: 'pageCursor',
		type: 'string',
		default: '',
		displayOptions: { show: { ...listShow, returnAll: [false] } },
		description: 'Token from a previous page. Leave empty for the first page.',
	},
];
