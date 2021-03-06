'use strict';

const
	should = require('should'),

	deps = require('../../../dependencies'),
	dbs = deps.dbs,

	Audit = dbs.admin.model('Audit'),
	auditService = require('./audit.service');

/**
 * Globals
 */
function clearDatabase() {
	return Audit.remove();
}

/**
 * Unit tests
 */
describe('Audit Service:', function() {

	let startTimestamp;
	before(() => {
		return clearDatabase()
			.then(() => {
				let now = Date.now();
				startTimestamp = now - (now % 1000); // remove milliseconds
			});
	});

	after(() => {
		return clearDatabase();
	});

	describe('Create new Audit entry', function() {

		it('should begin with no audits', function() {
			return Audit.find({}).exec().then((results) => {
				should(results).be.an.Array();
				should(results).have.length(0);
			});
		});

		it('should be able to create a new audit through the service', function() {
			return auditService.audit('some message', 'eventType', 'eventAction', 'eventActor', 'eventObject');
		});

		it('should have one audit entry', function() {
			return Audit.find({}).exec()
				.then((results) => {
					should(results).be.an.Array();
					should(results).have.length(1);
					/*
					 * Audit's created date should be after the unit tests started,
					 * but may be the same time since ISO Date strips off the milliseconds,
					 * so we'll remove 1 from the zero'ed milliseconds of the startTimestamp
					 */
					should(results[0].created).be.above(startTimestamp - 1);
					should(results[0].message).equal('some message');
					should(results[0].audit.auditType).equal('eventType');
					should(results[0].audit.action).equal('eventAction');
					should(results[0].audit.actor).equal('eventActor');
					should(results[0].audit.object).equal('eventObject');
				});
		});

		it('should have one distinct action', function() {
			return Audit.distinct('audit.action', {}).exec()
				.then((results) => {
					should(results).be.an.Array();
					should(results.length).equal(1);
					should(results).containDeep([ 'eventAction' ]);
				});
		});

	});

});
