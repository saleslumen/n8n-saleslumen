import type {
	IAuthenticate,
	ICredentialTestRequest,
	ICredentialType,
	IDataObject,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class SaleslumenApi implements ICredentialType {
	name = 'saleslumenApi';
	displayName = 'Saleslumen API';
	icon: Icon = { light: 'file:../icons/saleslumen.svg', dark: 'file:../icons/saleslumen.dark.svg' };
	documentationUrl = 'https://developers.saleslumen.com/en-US/emails/guides/authentication';
	properties: INodeProperties[] = [
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'options',
			options: [
				{ name: 'API Key', value: 'apiKey' },
				{ name: 'Access Token', value: 'accessToken' },
			],
			default: 'apiKey',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'e.g. sl_key_...',
			description: 'Organization API key. Sent only as sl-api-key.',
			displayOptions: { show: { authentication: ['apiKey'] } },
		},
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'User OAuth2 access token or user JWT. Sent as Authorization Bearer. Required for workflow start and resume, and for Apps Script run.',
			displayOptions: { show: { authentication: ['accessToken'] } },
		},
		{
			displayName: 'Organization ID',
			name: 'organizationId',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'e.g. 018f...',
			description: 'Organization UUID. Sent as sl-organization-id.',
		},
	];
	authenticate: IAuthenticate = async (credentials, requestOptions) => {
		const headers: IDataObject = { ...(requestOptions.headers ?? {}) };
		for (const key of Object.keys(headers)) {
			if (key.toLowerCase() === 'authorization' || key.toLowerCase() === 'sl-api-key') delete headers[key];
		}
		headers['sl-organization-id'] = String(credentials.organizationId ?? '');
		if (String(credentials.authentication ?? 'apiKey') === 'accessToken') {
			headers.Authorization = `Bearer ${String(credentials.accessToken ?? '')}`;
		} else {
			headers['sl-api-key'] = String(credentials.apiKey ?? '');
		}
		return { ...requestOptions, headers };
	};
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://emails.saleslumenapis.com',
			url: '/v1/accounts',
			method: 'GET',
		},
	};
}
