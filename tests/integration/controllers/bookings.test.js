const bookingController = require("../../../controllers/bookings");
const Booking = require("../../../models/Booking");
const Company = require("../../../models/Company");
const User = require("../../../models/User");
const mongoose = require("mongoose");


beforeAll(() => {
	jest.spyOn(console, "log").mockImplementation(() => { });
});

afterAll(() => {
	console.log.mockRestore();
});

describe("Booking Controller Integration", () => {
	let req, res;
	let user, admin, companyManager, company, booking;

	beforeEach(async () => {
		req = {
			query: {},
			params: {},
			user: {},
			body: {},
		};
		res = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn(),
		};


		user = await User.create({
			name: "Test User",
			email: "user@test.com",
			password: "password123",
			tel: "0812345678",
			role: "user",
		});

		admin = await User.create({
			name: "Admin User",
			email: "admin@test.com",
			password: "password123",
			tel: "0812345678",
			role: "admin",
		});

		companyManager = await User.create({
			name: "Company Mngr",
			email: "cm@test.com",
			password: "password123",
			tel: "0812345678",
			role: "company",
		});

		company = await Company.create({
			name: "Test Company",
			address: "Test Addr",
			district: "Dist",
			province: "Prov",
			postalcode: "12345",
			tel: "0812345678",
			website: "http://test.com",
			description: "Test desc",
			managerAccount: companyManager._id,
		});

		booking = await Booking.create({
			bookingDate: "2022-05-11",
			user: user._id,
			company: company._id,
		});
	});

	describe("getBookings", () => {
		it("should retrieve all bookings for admin", async () => {
			req.user = { id: admin._id.toString(), role: "admin" };
			await bookingController.getBookings(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({
					success: true,
					count: 1,
					data: expect.any(Array),
				}),
			);
		});

		it("should filter bookings by companyId for admin if specified", async () => {
			req.user = { id: admin._id.toString(), role: "admin" };
			req.params.companyId = company._id;
			await bookingController.getBookings(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({ count: 1 }),
			);
		});

		it("should retrieve bookings for company manager", async () => {
			req.user = { id: companyManager._id.toString(), role: "company" };
			await bookingController.getBookings(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({ count: 1 }),
			);
		});

		it("should return 404 for company role with no company associated", async () => {
			const anotherMngr = await User.create({
				name: "Another Mngr",
				email: "am@test.com",
				password: "password123",
				tel: "0812345678",
				role: "company",
			});
			req.user = { id: anotherMngr._id.toString(), role: "company" };
			await bookingController.getBookings(req, res);

			expect(res.status).toHaveBeenCalledWith(404);
		});

		it("should retrieve only user bookings for normal user", async () => {
			req.user = { id: user._id.toString(), role: "user" };
			await bookingController.getBookings(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({ count: 1 }),
			);
		});

		it("should handle select and sort", async () => {
			req.user = { id: admin._id.toString(), role: "admin" };
			req.query = { select: "bookingDate", sort: "-createdAt" };
			await bookingController.getBookings(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
		});

		it("should handle pagination and regex", async () => {

			for (let i = 0; i < 30; i++) {
				await Booking.create({
					bookingDate: "2022-05-11",
					user: user._id,
					company: company._id,
				});
			}
			req.user = { id: admin._id.toString(), role: "admin" };
			req.query = { page: "2", limit: "15", bookingDate: { gt: "2022-01-01" } };
			await bookingController.getBookings(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({
					pagination: expect.objectContaining({
						next: expect.any(Object),
						prev: expect.any(Object)
					})
				}),
			);
		});

		it("should handle CastError", async () => {
			req.user = { id: admin._id.toString(), role: "admin" };
			req.params.companyId = "invalidId";
			await bookingController.getBookings(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
		});

		it("should return 500 on server error", async () => {
			req.user = { id: admin._id.toString(), role: "admin" };
			const orig = Booking.countDocuments;
			Booking.countDocuments = jest.fn().mockRejectedValue(new Error("DB Fail"));

			await bookingController.getBookings(req, res);

			expect(res.status).toHaveBeenCalledWith(500);
			Booking.countDocuments = orig;
		});
	});

	describe("getBooking", () => {
		it("should retrieve a booking if authorized owner", async () => {
			req.user = { id: user._id.toString(), role: "user" };
			req.params.id = booking._id;
			await bookingController.getBooking(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({ success: true }),
			);
		});

		it("should return 404 if not found", async () => {
			req.user = { id: user._id.toString(), role: "user" };
			req.params.id = new mongoose.Types.ObjectId();
			await bookingController.getBooking(req, res);

			expect(res.status).toHaveBeenCalledWith(404);
		});

		it("should return 403 if not authorized", async () => {
			const anotherUser = await User.create({
				name: "Another",
				email: "another@test.com",
				password: "password123",
				tel: "0811111111",
				role: "user",
			});
			req.user = { id: anotherUser._id, role: "user" };
			req.params.id = booking._id;
			await bookingController.getBooking(req, res);

			expect(res.status).toHaveBeenCalledWith(403);
		});

		it("should return 500 on server error", async () => {
			req.params.id = "invalid";
			await bookingController.getBooking(req, res);
			expect(res.status).toHaveBeenCalledWith(500);
		});

		it("should allow company manager to view their own bookings", async () => {
			req.user = { id: companyManager._id.toString(), role: "company" };
			req.params.id = booking._id;
			await bookingController.getBooking(req, res);
			expect(res.status).toHaveBeenCalledWith(200);


			const anotherMngr = await User.create({ name: "Un", email: "un@t.com", password: "password123", tel: "0812345678", role: "company" });
			req.user = { id: anotherMngr._id.toString(), role: "company" };
			await bookingController.getBooking(req, res);
			expect(res.status).toHaveBeenCalledWith(403);


			const anotherCompany = await Company.create({ name: "Another Co", managerAccount: anotherMngr._id, address: "Addr", district: "Dist", province: "Prov", postalcode: "12345", tel: "0812345678", website: "http://another.com", description: "Desc" });
			const anotherBooking = await Booking.create({ bookingDate: "2022-05-11", user: user._id, company: anotherCompany._id });

			req.user = { id: companyManager._id.toString(), role: "company" };
			req.params.id = anotherBooking._id;
			await bookingController.getBooking(req, res);
			expect(res.status).toHaveBeenCalledWith(403);
		});

		it("should allow admin to view any booking", async () => {
			req.user = { id: admin._id.toString(), role: "admin" };
			req.params.id = booking._id;
			await bookingController.getBooking(req, res);
			expect(res.status).toHaveBeenCalledWith(200);
		});

		it("should return false if booking has no user", async () => {
			const bookingNoUser = new Booking({ bookingDate: "2022-05-11", company: company._id });
			await bookingNoUser.save({ validateBeforeSave: false });

			req.user = { id: admin._id.toString(), role: "admin" };
			req.params.id = bookingNoUser._id;

			// Wait, isOwnerOrAdmin is called inside getBooking.
			await bookingController.getBooking(req, res);
			// Wait, if admin, it returns true BEFORE checking booking.user.
			// So to hit line 11, we need a non-admin role.
			req.user = { id: user._id.toString(), role: "user" };
			await bookingController.getBooking(req, res);
			expect(res.status).toHaveBeenCalledWith(403);
		});
	});

	describe("addBooking", () => {
		it("should prevent booking outside allowed dates", async () => {
			req.user = { id: user._id.toString(), role: "user" };
			req.params.companyId = company._id;
			req.body = { bookingDate: "2023-01-01" };
			await bookingController.addBooking(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({
					msg: "Booking date must be between May 10-13, 2022",
				}),
			);
		});

		it("should return 404 if company not found", async () => {
			req.user = { id: user._id.toString(), role: "user" };
			req.params.companyId = new mongoose.Types.ObjectId();
			await bookingController.addBooking(req, res);

			expect(res.status).toHaveBeenCalledWith(404);
		});

		it("should block if user has 3 bookings already", async () => {
			await Booking.create({ bookingDate: "2022-05-10", user: user._id, company: company._id });
			await Booking.create({ bookingDate: "2022-05-12", user: user._id, company: company._id });


			req.user = { id: user._id.toString(), role: "user" };
			req.params.companyId = company._id;
			req.body = { bookingDate: "2022-05-13" };
			await bookingController.addBooking(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({ msg: "User has already made 3 bookings" }),
			);
		});

		it("should allow admin to bypass 3 booking limit", async () => {
			await Booking.create({ bookingDate: "2022-05-10", user: admin._id, company: company._id });
			await Booking.create({ bookingDate: "2022-05-11", user: admin._id, company: company._id });
			await Booking.create({ bookingDate: "2022-05-12", user: admin._id, company: company._id });

			req.user = { id: admin._id.toString(), role: "admin" };
			req.params.companyId = company._id;
			req.body = { bookingDate: "2022-05-13" };
			await bookingController.addBooking(req, res);

			expect(res.status).toHaveBeenCalledWith(201);
		});

		it("should create booking on success", async () => {
			req.user = { id: user._id.toString(), role: "user" };
			req.params.companyId = company._id;
			req.body = { bookingDate: "2022-05-12" };
			await bookingController.addBooking(req, res);

			expect(res.status).toHaveBeenCalledWith(201);
		});

		it("should return 400 on ValidationError", async () => {
			req.user = { id: user._id.toString(), role: "user" };
			req.params.companyId = company._id;
			req.body = {};


			const origCreate = Booking.create;
			Booking.create = jest.fn().mockRejectedValue({ name: "ValidationError", message: "Validation error" });

			req.body = { bookingDate: "2022-05-12" };
			await bookingController.addBooking(req, res);
			expect(res.status).toHaveBeenCalledWith(400);

			Booking.create = origCreate;
		});

		it("should return 500 on server error", async () => {
			req.params.companyId = "invalid";
			await bookingController.addBooking(req, res);
			expect(res.status).toHaveBeenCalledWith(500);
		});
	});

	describe("updateBooking", () => {
		it("should update booking date if valid", async () => {
			req.user = { id: user._id.toString(), role: "user" };
			req.params.id = booking._id;
			req.body = { bookingDate: "2022-05-13" };

			await bookingController.updateBooking(req, res);

			expect(res.status).toHaveBeenCalledWith(200);

			const updated = await Booking.findById(booking._id);
			expect(new Date(updated.bookingDate).toISOString().startsWith("2022-05-13")).toBeTruthy();
		});

		it("should fail if invalid date is provided", async () => {
			req.user = { id: user._id.toString(), role: "user" };
			req.params.id = booking._id;
			req.body = { bookingDate: "2023-01-01" };

			await bookingController.updateBooking(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
		});

		it("should fail if unauthorized", async () => {
			const anotherUser = await User.create({
				name: "Another",
				email: "another@test.com",
				password: "password123",
				tel: "0822222222",
				role: "user",
			});
			req.user = { id: anotherUser._id, role: "user" };
			req.params.id = booking._id;

			await bookingController.updateBooking(req, res);

			expect(res.status).toHaveBeenCalledWith(403);
		});

		it("should handle 404", async () => {
			req.user = { id: user._id.toString(), role: "user" };
			req.params.id = new mongoose.Types.ObjectId();

			await bookingController.updateBooking(req, res);

			expect(res.status).toHaveBeenCalledWith(404);
		});

		it("should handle CastError", async () => {
			req.user = { id: user._id.toString(), role: "user" };
			req.params.id = booking._id;
			req.body = { company: "invalidCompany" };

			await bookingController.updateBooking(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ msg: "Invalid Company ID" }));
		});

		it("should handle ValidationError", async () => {
			req.user = { id: user._id.toString(), role: "user" };
			req.params.id = booking._id;

			const orig = Booking.findByIdAndUpdate;
			Booking.findByIdAndUpdate = jest.fn().mockRejectedValue({ name: "ValidationError", message: "Validation error" });

			await bookingController.updateBooking(req, res);

			expect(res.status).toHaveBeenCalledWith(400);

			Booking.findByIdAndUpdate = orig;
		});

		it("should return 400 on CastError", async () => {
			req.params.id = "invalid";
			await bookingController.updateBooking(req, res);
			expect(res.status).toHaveBeenCalledWith(400);
		});

		it("should return 500 on server error", async () => {
			req.user = { id: user._id.toString(), role: "user" };
			req.params.id = booking._id;
			const orig = Booking.findByIdAndUpdate;
			Booking.findByIdAndUpdate = jest.fn().mockRejectedValue(new Error("DB Fail"));

			await bookingController.updateBooking(req, res);

			expect(res.status).toHaveBeenCalledWith(500);
			Booking.findByIdAndUpdate = orig;
		});
	});

	describe("deleteBooking", () => {
		it("should delete booking if authorized", async () => {
			req.user = { id: user._id.toString(), role: "user" };
			req.params.id = booking._id;

			await bookingController.deleteBooking(req, res);

			expect(res.status).toHaveBeenCalledWith(200);

			const deleted = await Booking.findById(booking._id);
			expect(deleted).toBeNull();
		});

		it("should fail if unauthorized", async () => {
			const anotherUser = await User.create({
				name: "Another",
				email: "another@test.com",
				password: "password123",
				tel: "0833333333",
				role: "user",
			});
			req.user = { id: anotherUser._id, role: "user" };
			req.params.id = booking._id;

			await bookingController.deleteBooking(req, res);

			expect(res.status).toHaveBeenCalledWith(403);
		});

		it("should handle 404", async () => {
			req.user = { id: user._id.toString(), role: "user" };
			req.params.id = new mongoose.Types.ObjectId();

			await bookingController.deleteBooking(req, res);

			expect(res.status).toHaveBeenCalledWith(404);
		});

		it("should return 500 on server error", async () => {
			req.params.id = "invalid";
			await bookingController.deleteBooking(req, res);
			expect(res.status).toHaveBeenCalledWith(500);
		});
	});
});
