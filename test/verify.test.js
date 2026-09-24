const assert = require('node:assert/strict');
const test = require('node:test');
const {
	assertVerifyBatchWithinLimit,
	missingVerifyDoneStages,
	normalizeVerifyEmail,
	requiredVerifyDoneStages,
	uniqueNormalizedVerifyEmails,
	validateVerifyStreamRows,
	verifyBatchAddressLimit,
} = require('../dist/nodes/shared/verify.js');

const standardDone = {
	done: true,
	stage: 'standard',
	total: 1,
	checked: 1,
	valid: 1,
	invalid: 0,
	catchAll: 0,
	unknown: 0,
	skipped: 0,
	errors: 0,
};
const catchAllDone = {
	done: true,
	stage: 'catch_all',
	total: 0,
	checked: 0,
	valid: 0,
	invalid: 0,
	catchAll: 0,
	unknown: 0,
	skipped: 0,
	errors: 0,
};

test('normalize and dedupe verify batch emails', () => {
	assert.equal(normalizeVerifyEmail('  Jane@Example.COM '), 'jane@example.com');
	assert.deepEqual(uniqueNormalizedVerifyEmails(['A@x.com', ' a@x.com ', 'B@x.com']), [
		'a@x.com',
		'b@x.com',
	]);
});

test('verify batch limits follow features', () => {
	assert.equal(verifyBatchAddressLimit(['STANDARD']), 1000);
	assert.equal(verifyBatchAddressLimit(['CATCH_ALL']), 100);
	assert.equal(verifyBatchAddressLimit(['STANDARD', 'CATCH_ALL']), 1000);
	assert.throws(() => assertVerifyBatchWithinLimit(1001, ['STANDARD']), /1000/);
	assert.throws(() => assertVerifyBatchWithinLimit(101, ['CATCH_ALL']), /100/);
	assert.doesNotThrow(() => assertVerifyBatchWithinLimit(1000, ['STANDARD', 'CATCH_ALL']));
});

test('required done stages from features', () => {
	assert.deepEqual(requiredVerifyDoneStages(['STANDARD']), ['standard']);
	assert.deepEqual(requiredVerifyDoneStages(['CATCH_ALL']), ['catch_all']);
	assert.deepEqual(requiredVerifyDoneStages(['STANDARD', 'CATCH_ALL']), ['standard', 'catch_all']);
});

test('validate verify stream rows', () => {
	assert.equal(
		validateVerifyStreamRows([{ error: true, message: 'Verification failed' }], ['STANDARD']).kind,
		'stream_error',
	);
	assert.equal(validateVerifyStreamRows([standardDone], ['STANDARD']).kind, 'ok');
	assert.equal(validateVerifyStreamRows([standardDone], ['CATCH_ALL']).kind, 'incomplete');
	assert.equal(validateVerifyStreamRows([catchAllDone], ['CATCH_ALL']).kind, 'ok');
	assert.equal(
		validateVerifyStreamRows([standardDone], ['STANDARD', 'CATCH_ALL']).kind,
		'incomplete',
	);
	assert.equal(
		validateVerifyStreamRows([standardDone, catchAllDone], ['STANDARD', 'CATCH_ALL']).kind,
		'ok',
	);
	assert.deepEqual(missingVerifyDoneStages([standardDone], ['STANDARD', 'CATCH_ALL']), ['catch_all']);
});
