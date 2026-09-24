const assert = require('node:assert/strict');
const test = require('node:test');
const {
	campaignUpdateBody,
	organizationResourceName,
	resolveRequestId,
	scriptProjectContent,
	scriptRunFailure,
	sequencePayload,
	verifyBody,
} = require('../dist/nodes/shared/contract.js');

test('verify body requires features and drops duplicates', () => {
	assert.deepEqual(verifyBody(['a@example.com'], ['CATCH_ALL', 'STANDARD', 'STANDARD']), {
		emails: ['a@example.com'],
		features: ['CATCH_ALL', 'STANDARD'],
	});
	assert.throws(() => verifyBody(['a@example.com'], []), /at least one/);
	assert.throws(() => verifyBody(['a@example.com'], ['smtp']), /Features must be/);
});

test('campaign update sends a mask for the fields present', () => {
	assert.deepEqual(campaignUpdateBody({ display_name: 'Outbound', stop_on_reply: true }, '3', '11111111-1111-4111-8111-111111111111'), {
		campaign: { display_name: 'Outbound', stop_on_reply: true },
		update_mask: 'display_name,stop_on_reply',
		etag: '3',
		request_id: '11111111-1111-4111-8111-111111111111',
	});
	assert.throws(() => campaignUpdateBody({}, '1', '11111111-1111-4111-8111-111111111111'), /update field/);
});

test('organization resource name and request id', () => {
	assert.equal(organizationResourceName('organizations/11111111-1111-4111-8111-111111111111'), 'organizations/11111111-1111-4111-8111-111111111111');
	assert.equal(resolveRequestId('22222222-2222-4222-8222-222222222222'), '22222222-2222-4222-8222-222222222222');
	assert.equal(resolveRequestId('', () => '33333333-3333-4333-8333-333333333333'), '33333333-3333-4333-8333-333333333333');
	assert.throws(() => resolveRequestId('not-a-uuid'), /UUID/);
});

test('sequence replace drops read-only fields', () => {
	assert.deepEqual(sequencePayload({ name: 'sequences/1', display_name: 'Follow up', etag: '4', steps: [] }), {
		display_name: 'Follow up',
		steps: [],
	});
});

test('script run reads the response envelope', () => {
	assert.equal(scriptRunFailure({ done: true, response: { success: true, commit_state: 'COMMITTED', result: 'ok' } }), undefined);
	assert.equal(scriptRunFailure({ done: true, response: { success: false, error: 'name is empty' } }), 'name is empty');
	assert.equal(scriptRunFailure({ error: { message: 'authenticated user required' } }), 'authenticated user required');
	assert.match(scriptRunFailure({ done: true, response: { success: true, commit_state: 'UNKNOWN' } }) ?? '', /unknown/);
	assert.match(scriptRunFailure({ done: true, response: { success: false, commit_state: 'UNKNOWN' } }) ?? '', /unknown/);
	assert.equal(
		scriptRunFailure({
			done: true,
			response: {
				success: false,
				committed: true,
				commit_state: 'COMMITTED',
				retryable: false,
				serialization_error: 'custom script completed but its result could not be serialized',
			},
		}),
		'custom script completed but its result could not be serialized',
	);
	assert.equal(
		scriptRunFailure({
			done: true,
			response: {
				success: false,
				commit_state: 'UNKNOWN',
				serialization_error: 'custom script completed but its result could not be serialized',
			},
		}),
		'custom script completed but its result could not be serialized',
	);
});

test('script project content accepts inner or wrapped body', () => {
	const files = [{ name: 'Code.js', type: 'SERVER_JS', source: 'function f() {}' }];
	assert.deepEqual(scriptProjectContent({ files }), { files });
	assert.deepEqual(scriptProjectContent({ content: { files } }), { files });
	assert.throws(() => scriptProjectContent({ title: 'x' }), /files array/);
});
