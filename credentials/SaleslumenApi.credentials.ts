import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SaleslumenApi implements ICredentialType {
	name = 'saleslumenApi';
	displayName = 'Saleslumen API';
	icon: Icon = { light: 'file:../icons/saleslumen.svg', dark: 'file:../icons/saleslumen.dark.svg' };
	documentationUrl = 'https://developers.saleslumen.com/en-US/emails/guides/authentication';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'e.g. sl_key_...',
			description: 'Organization API key. Send only as sl-api-key — never as Authorization Bearer',
		},
		{
			displayName: 'Organization ID',
			name: 'organizationId',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'e.g. 018f...',
			description: 'Organization UUID. Required by product APIs; for API keys the gateway still derives org from the key',
		},
	];
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'sl-api-key': '={{$credentials.apiKey}}',
				'sl-organization-id': '={{$credentials.organizationId}}',
			},
		},
	};
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://emails.saleslumenapis.com',
			url: '/v1/accounts',
			method: 'GET',
		},
	};
}
