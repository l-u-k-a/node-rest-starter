'use strict';

const path = require('path'),
	config = require('../config'),
	logger = require('./bunyan').logger,

	bodyParser = require('body-parser'),
	compress = require('compression'),
	cookieParser = require('cookie-parser'),
	express = require('express'),
	session = require('express-session'),
	flash = require('connect-flash'),
	helmet = require('helmet'),
	methodOverride = require('method-override'),
	morgan = require('morgan'),
	passport = require('passport'),

	MongoStore = require('connect-mongo')(session);

/**
 * Initialize local variables
 */
function initLocalVariables(app) {
	// Setting application local variables
	app.locals.title = config.app.title;
	app.locals.description = config.app.description;
	app.locals.keywords = config.app.keywords;

	// Development
	app.locals.developmentMode = config.mode === 'development';

	// Passing the request url to environment locals
	app.use(function (req, res, next) {
		res.locals.host = config.app.serverUrlWithoutPort;
		res.locals.url = config.app.clientUrl + req.originalUrl;
		next();
	});
}

/**
 * Initialize application middleware
 */
function initMiddleware(app) {
	// Showing stack errors
	app.set('showStackError', true);

	// Should be placed before express.static
	app.use(compress({
		filter: function (req, res) {
			if (req.headers['x-no-compression']) {
				// don't compress responses with this request header
				return false;
			}

			// fallback to standard filter function
			return compress.filter(req, res);
		},
		level: 6
	}));

	// Environment dependent middleware
	if (config.mode === 'development') {
		// Disable views cache
		app.set('view cache', false);
	} else if (config.mode === 'production') {
		app.locals.cache = 'memory';
	}

	// Optionally turn on express logging
	if (config.expressLogging) {
		app.use(morgan('dev'));
	}

	// Request body parsing middleware should be above methodOverride
	app.use(bodyParser.urlencoded({
		extended: true
	}));
	app.use(bodyParser.json());
	app.use(methodOverride());

	// Add the cookie parser and flash middleware
	app.use(cookieParser(config.auth.sessionSecret));
	app.use(flash());

}

/**
 * Configure view engine
 */
function initViewEngine(app) {
	// Not using server rendering for views
}

/**
 * Configure Express session
 */
function initSession(app, db) {
	// Express MongoDB session storage
	app.use(session({
		saveUninitialized: true,
		resave: true,
		secret: config.auth.sessionSecret,
		cookie: config.auth.sessionCookie,
		store: new MongoStore({
			db: db.connection.db,
			collection: config.auth.sessionCollection
		})
	}));
}

/**
 * Configure passport
 */
function initPassport(app) {
	app.use(passport.initialize());
	app.use(passport.session());

	require('./passport').init();
}

/**
 * Invoke modules server configuration
 */
function initModulesConfiguration(app, db) {
	config.files.configs.forEach(function (configPath) {
		require(path.posix.resolve(configPath))(app, db);
	});
}

/**
 * Configure Helmet headers configuration
 */
function initHelmetHeaders(app) {
	// Use helmet to secure Express headers
	app.use(helmet.frameguard());
	app.use(helmet.xssFilter());
	app.use(helmet.noSniff());
	app.use(helmet.ieNoOpen());
	app.disable('x-powered-by');
}

/**
 * Configure the modules server routes
 */
function initModulesServerRoutes(app) {
	// Init the global route prefix
	let router = express.Router();

	// Use all routes
	config.files.routes.forEach((routePath) => {
		router.use(require(path.posix.resolve(routePath)));
	});

	// Host everything behind a single endpoint
	app.use('/api', router);
}

/**
 * Configure the modules sockets by simply including the files.
 * Do not instantiate the modules.
 */
function initModulesServerSockets(app) {
	// Globbing socket files
	config.files.sockets.forEach((socketPath) => {
		require(path.posix.resolve(socketPath));
	});
}

/**
 * Configure final error handlers
 */
function initErrorRoutes(app) {

	// If there's an error, handle it
	app.use((err, req, res, next) => {
		// If the error object doesn't exists
		if (!err) return next();

		// Log it
		logger.error(err);

		// send server error
		res.status(500).json({
			status: 500,
			type: 'server-error',
			message: 'Unexpected server error'
		});
	});

	// Assume 404 since no middleware responded
	app.use((req, res) => {
		// Send 404 with error message
		res.status(404).json({
			status: 404,
			type: 'not-found',
			message: 'The resource was not found'
		});
	});
}

/**
 * Configure Socket.io
 */
function configureSocketIO(app, db) {
	// Load the Socket.io configuration
	return require('./socket.io')(app, db);
}

/**
 * Initialize the Express application
 */
module.exports.init = function (db) {

	// Initialize express app
	logger.info('Initializing Express');
	var app = express();

	// Initialize local variables
	initLocalVariables(app);

	// Initialize Express middleware
	initMiddleware(app);

	// Initialize Express view engine
	initViewEngine(app);

	// Initialize Express session
	initSession(app, db);

	// Initialize passport auth
	initPassport(app);

	// Initialize Modules configuration
	initModulesConfiguration(app);

	// Initialize Helmet security headers
	initHelmetHeaders(app);

	// Initialize modules server routes
	initModulesServerRoutes(app);

	// Initialize modules sockets
	initModulesServerSockets(app);

	// Initialize error routes
	initErrorRoutes(app);

	// Configure Socket.io
	app = configureSocketIO(app, db);

	return app;
};