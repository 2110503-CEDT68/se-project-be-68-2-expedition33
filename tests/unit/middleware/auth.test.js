const { protect, authorize } = require("../../../middleware/auth");
const jwt = require("jsonwebtoken");
const User = require("../../../models/User");

// Mock dependencies
jest.mock("jsonwebtoken");
jest.mock("../../../models/User");

// Suppress console.log for clean test output
console.log = jest.fn();

describe("Auth Middleware", () => {
	let req, res, next;

	beforeEach(() => {
		req = {
			headers: {},
		};
		res = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn(),
		};
		next = jest.fn();
		jest.clearAllMocks();
	});

	describe("protect", () => {
		it("should return 401 if no authorization header", async () => {
			await protect(req, res, next);

			expect(res.status).toHaveBeenCalledWith(401);
			expect(res.json).toHaveBeenCalledWith({
				success: false,
				msg: "Not authorize to access this route",
			});
		});

		it("should return 401 if header does not start with Bearer", async () => {
			req.headers.authorization = "Token 123456";
			await protect(req, res, next);

			expect(res.status).toHaveBeenCalledWith(401);
			expect(res.json).toHaveBeenCalledWith({
				success: false,
				msg: "Not authorize to access this route",
			});
		});

		it("should return 401 if token is verified but error thrown (e.g. invalid token)", async () => {
			req.headers.authorization = "Bearer invalidtoken";
			jwt.verify.mockImplementation(() => {
				throw new Error("Invalid token");
			});

			await protect(req, res, next);

			expect(console.log).toHaveBeenCalled();
			expect(res.status).toHaveBeenCalledWith(401);
			expect(res.json).toHaveBeenCalledWith({
				success: false,
				msg: "Not authorize to access this route",
			});
		});

		it("should call next if token is valid and user is found", async () => {
			req.headers.authorization = "Bearer validtoken";
			jwt.verify.mockReturnValue({ id: "userid" });
			User.findById.mockResolvedValue({ id: "userid", name: "Test User" });

			await protect(req, res, next);

			expect(req.user).toEqual({ id: "userid", name: "Test User" });
			expect(next).toHaveBeenCalled();
		});
	});

	describe("authorize", () => {
		it("should return 403 if user role is not authorized", () => {
			req.user = { role: "user" };
			const middleware = authorize("admin");

			middleware(req, res, next);

			expect(res.status).toHaveBeenCalledWith(403);
			expect(res.json).toHaveBeenCalledWith({
				success: false,
				msg: `User role user is not authorized to access this route`,
			});
		});

		it("should call next if user role is authorized", () => {
			req.user = { role: "admin" };
			const middleware = authorize("admin", "company");

			middleware(req, res, next);

			expect(next).toHaveBeenCalled();
		});
	});
});
