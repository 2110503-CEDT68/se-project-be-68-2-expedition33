const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const helmet = require("helmet");
const xss = require("xss-clean");
const rateLimit = require("express-rate-limit");
const hpp = require("hpp");
const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUI = require("swagger-ui-express");

// Load env vars
dotenv.config({ path: "./config/config.env" });

// Connect to database
connectDB();

// Route files
const companies = require("./routes/companies");
const auth = require("./routes/auth");
const bookings = require("./routes/bookings");

const app = express();
const cors = require("cors");

const HOST = process.env.HOST || "http://localhost";
const PORT = process.env.PORT || 5000;

// Body parser
app.use(express.json());

// Query parser
app.set("query parser", "extended");

// Cookie parser
app.use(cookieParser());

// Fix for Express 5 + express-mongo-sanitize compatibility
app.use((req, res, next) => {
	Object.defineProperty(req, "query", {
		value: req.query,
		writable: true,
		configurable: true,
		enumerable: true,
	});
	next();
});

// Sanitize data
app.use(mongoSanitize());

// Set security headers
app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: [
					"'self'",
					"'unsafe-inline'",
					"https://cdnjs.cloudflare.com",
				],
				styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
				imgSrc: ["'self'", "data:", "https://cdnjs.cloudflare.com"],
			},
		},
	}),
);

// Prevent XSS attacks
app.use(xss());

// Rate limiting
const limiter = rateLimit({
	windowMs: 1 * 60 * 1000, // 1 min
	max: 100,
});
app.use(limiter);

// Prevent http param pollutions
app.use(hpp());

// Enable CORS
app.use(cors());

// Swagger
const swaggerDocs = swaggerJsDoc({
	swaggerDefinition: {
		openapi: "3.0.0",
		info: {
			title: "Library API",
			version: "1.0.0",
			description: "A simple Express Online JobFair Booking API",
		},
		servers: [
			{
				url: HOST + ":" + PORT + "/api/v1",
			},
		],
	},
	apis: ["./routes/*.js"],
});

const swaggerOptions = {
	customCssUrl:
		"https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui.min.css",
	customJs: [
		"https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui-bundle.min.js",
		"https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui-standalone-preset.min.js",
	],
};

app.use(
	"/api-docs",
	swaggerUI.serve,
	swaggerUI.setup(swaggerDocs, swaggerOptions),
);

// Mount rounters
app.use("/api/v1/companies", companies);
app.use("/api/v1/auth", auth);
app.use("/api/v1/bookings", bookings);

const server = app.listen(
	PORT,
	console.log("Server running in", process.env.NODE_ENV, "mode on port", PORT),
);

process.on("unhandledRejection", (err, promise) => {
	console.log(`Error: ${err.message}`);

	// Close server & exit process
	server.close(() => process.exit(1));
});
