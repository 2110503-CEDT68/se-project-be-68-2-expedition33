const authController = require("../../../controllers/auth");
const User = require("../../../models/User");
const Company = require("../../../models/Company");
const mongoose = require("mongoose");


beforeAll(() => {
	jest.spyOn(console, "log").mockImplementation(() => {});
});

afterAll(() => {
	console.log.mockRestore();
});

describe("Auth Controller Integration", () => {
	let req, res;

	beforeEach(() => {
		req = {
			body: {},
			user: {},
		};
		res = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn(),
			cookie: jest.fn().mockReturnThis(),
		};
	});

	describe("register", () => {
		it("should register a new user successfully", async () => {
			req.body = {
				name: "Test User",
				email: "test@test.com",
				password: "password123",
				tel: "0812345678",
				role: "user",
			};

			await authController.register(req, res);

			expect(res.status).toHaveBeenCalledWith(201);
			expect(res.cookie).toHaveBeenCalledWith(
				"token",
				expect.any(String),
				expect.any(Object),
			);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({
					success: true,
					token: expect.any(String),
				}),
			);
		});

		it("should return 400 Validation Error if fields are missing", async () => {
			req.body = { name: "Test User" };

			await authController.register(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({ success: false }),
			);
		});

		it("should return 400 if email already exists (Duplicate)", async () => {

			await User.create({
				name: "First",
				email: "duplicate@test.com",
				password: "password123",
				tel: "0812345678",
			});

			req.body = {
				name: "Second",
				email: "duplicate@test.com",
				password: "password123",
				tel: "0812345678",
			};

			await authController.register(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith({
				success: false,
				msg: "User with this email already exists",
			});
		});

		it("should return 500 on server error", async () => {
			const originalCreate = User.create;
			User.create = jest.fn().mockRejectedValue(new Error("Database failure"));

			req.body = {
				name: "Error",
				email: "error@test.com",
				password: "password123",
				tel: "0812345678",
			};

			await authController.register(req, res);

			expect(res.status).toHaveBeenCalledWith(500);

			User.create = originalCreate;
		});
	});

	describe("login", () => {
		beforeEach(async () => {
			await User.create({
				name: "Login User",
				email: "login@test.com",
				password: "password123",
				tel: "0812345678",
			});
		});

		it("should login successfully and return token", async () => {
			req.body = { email: "login@test.com", password: "password123" };

			await authController.login(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({ success: true, token: expect.any(String) }),
			);
		});

		it("should return 400 if missing email or password", async () => {
			req.body = { email: "login@test.com" };

			await authController.login(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith({
				success: false,
				msg: "Please provide an email and password",
			});
		});

		it("should return 400 for invalid email", async () => {
			req.body = { email: "wrong@test.com", password: "password123" };

			await authController.login(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith({
				success: false,
				msg: "Invalid credentials",
			});
		});

		it("should return 400 for invalid password", async () => {
			req.body = { email: "login@test.com", password: "wrong" };

			await authController.login(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith({
				success: false,
				msg: "Invalid credentials",
			});
		});
	});

	describe("getMe", () => {
		let user;

		beforeEach(async () => {
			user = await User.create({
				name: "Me User",
				email: "me@test.com",
				password: "password123",
				tel: "0812345678",
				role: "user",
			});
		});

		it("should get current logged in user", async () => {
			req.user = { id: user._id };

			await authController.getMe(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({
					success: true,
					data: expect.objectContaining({ email: "me@test.com" }),
				}),
			);
		});

		it("should append companyData if role is company", async () => {

			await User.findByIdAndUpdate(user._id, { role: "company" });


			const company = await Company.create({
				name: "My Company",
				address: "123",
				district: "Dist",
				province: "Prov",
				postalcode: "12345",
				tel: "0812345678",
                website: "http://test.com",
                description: "Test Desc",
				managerAccount: user._id,
			});

			req.user = { id: user._id, role: "company" };

			await authController.getMe(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({
					success: true,
					data: expect.objectContaining({
						companyData: expect.objectContaining({
							name: "My Company",
						}),
					}),
				}),
			);
		});
        
        it("should return null for companyData if company not found for manager", async () => {
			await User.findByIdAndUpdate(user._id, { role: "company" });

			req.user = { id: user._id, role: "company" };

			await authController.getMe(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({
					success: true,
					data: expect.objectContaining({
						companyData: null,
					}),
				}),
			);
		});

		it("should return 404 if user not found", async () => {
			req.user = { id: new mongoose.Types.ObjectId() };

			await authController.getMe(req, res);

			expect(res.status).toHaveBeenCalledWith(404);
		});

		it("should return 500 on server error", async () => {
			req.user = { id: "invalidId" };

			await authController.getMe(req, res);

			expect(res.status).toHaveBeenCalledWith(500);
		});
	});

	describe("logout", () => {
		it("should clear cookie and logout", async () => {
			await authController.logout(req, res);

			expect(res.cookie).toHaveBeenCalledWith(
				"token",
				"none",
				expect.any(Object),
			);
			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({ success: true, data: {} });
		});
	});
});


describe("Auth sendTokenResponse in Production", () => {
	let req, res;
	beforeEach(() => {
		req = { body: {} };
		res = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn(),
			cookie: jest.fn().mockReturnThis(),
		};
	});

	it("should set secure cookie in production", async () => {
		process.env.NODE_ENV = "production";

		await User.create({
			name: "Prod User",
			email: "prod@test.com",
			password: "password123",
			tel: "0812345678",
		});

		req.body = { email: "prod@test.com", password: "password123" };
		await authController.login(req, res);

		expect(res.cookie).toHaveBeenCalledWith(
			"token",
			expect.any(String),
			expect.objectContaining({ secure: true }),
		);

		process.env.NODE_ENV = "test";
	});
});
