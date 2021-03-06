'use strict';

const
	should = require('should'),
	proxyquire = require('proxyquire'),

	deps = require('../../../dependencies'),
	config = deps.config;

/**
 * Helpers
 */

function createSubjectUnderTest(dependencies) {
	const stubs = {};
	stubs['../../../dependencies'] = dependencies || {};
	return proxyquire('./feedback.service', stubs);
}

/**
 * Unit tests
 */
describe('Feedback Service:', () => {
	let mailOptions = null;

	let feedbackService = createSubjectUnderTest({
		// config: config,
		emailService: {
			sendMail: (mo) => {
				mailOptions = mo;
			},
			buildEmailContent: deps.emailService.buildEmailContent,
			buildEmailSubject: deps.emailService.buildEmailSubject,
			generateMailOptions: deps.emailService.generateMailOptions
		}
	});

	const user = {
		name: 'test',
		username: 'test',
		email: 'test@test.test'
	};

	describe('sendFeedback', () => {
		it('should reject invalid feedback', async() => {
			let error = null;
			try {
				await feedbackService.sendFeedback(user, {});
			} catch(e) {
				error = e;
			}
			should.exist(error);
			error.status.should.equal(400);
			error.message.should.equal('Invalid submission.');
		});

		it('should create mailOptions properly', async() => {
			const feedback = {
				body: 'feedback body',
				type: 'type',
				url: 'url'
			};

			const expectedEmailContent = `HEADER
<p>Hey there ${config.app.title} Admins,</p>
<p>A user named <b>${user.name}</b> with username <b>${user.username}</b> and email <b>${user.email}</b> has submitted the following ${feedback.type}:</p>
<p>${feedback.body}</p>
<p>Submitted from: ${feedback.url}</p>
FOOTER
`;

			await feedbackService.sendFeedback(user, feedback, {});

			should.exist(mailOptions, 'expected mailOptions to exist');

			for (const key of ['bcc', 'from', 'replyTo', 'subject', 'html']) {
				should.exist(mailOptions[key], `expected mailOptions.${key} to exist`);
			}

			mailOptions.bcc.should.equal(config.coreEmails.feedbackEmail.bcc);
			mailOptions.from.should.equal(config.coreEmails.default.from);
			mailOptions.replyTo.should.equal(config.coreEmails.default.replyTo);
			mailOptions.subject.should.equal(`${config.app.title}: Feedback Submitted`);
			mailOptions.html.should.equal(expectedEmailContent);
		});
	});

});
