const assert = require('node:assert/strict');
const test = require('node:test');
const { listPageQuery } = require('../dist/nodes/shared/transport.js');

test('listPageQuery omits request token when cursor is empty', () => {
	assert.deepEqual(listPageQuery({ pageSize: 50, pageToken: 'stale' }, 'pageToken', ''), {
		pageSize: 50,
	});
	assert.equal('pageToken' in listPageQuery({ pageSize: 50 }, 'pageToken', ''), false);
});

test('listPageQuery sends workflow cursor as pageToken', () => {
	assert.deepEqual(listPageQuery({ pageSize: 50 }, 'pageToken', '50'), {
		pageSize: 50,
		pageToken: '50',
	});
});

test('listPageQuery sends campaign cursor as page_token', () => {
	assert.deepEqual(listPageQuery({ pageSize: 10 }, 'page_token', 'abc'), {
		pageSize: 10,
		page_token: 'abc',
	});
});

test('listPageQuery does not add response pagination keys', () => {
	const page = listPageQuery({ pageSize: 50 }, 'pageToken', '50');
	assert.equal('nextPageToken' in page, false);
	assert.equal('next_page_token' in page, false);
});
