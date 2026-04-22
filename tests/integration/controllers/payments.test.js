const paymentController = require("../../../controllers/payments");
const Payment = require("../../../models/Payment");
const Company = require("../../../models/Company");
const User = require("../../../models/User");
const mongoose = require("mongoose");


beforeAll(() => {
	jest.spyOn(console, "log").mockImplementation(() => {});
});

afterAll(() => {
	console.log.mockRestore();
});

describe("Payment Controller Integration", () => {
	let req, res;
	let admin, companyManager, company, payment;

	beforeEach(async () => {
		req = {
			query: {},
			params: {},
			user: {},
			body: {},
		};
		res = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn().mockReturnThis(),
		};

		admin = await User.create({
			name: "Admin",
			email: "admin@dev.com",
			password: "password123",
			tel: "0811111111",
			role: "admin",
		});

		companyManager = await User.create({
			name: "Manager",
			email: "manager@dev.com",
			password: "password123",
			tel: "0822222222",
			role: "company",
		});

		company = await Company.create({
			name: "Test Co",
			managerAccount: companyManager._id,
			address: "Add",
			district: "Dist",
			province: "Prov",
			postalcode: "12345",
			tel: "0812345678",
            website: "http://test.com",
            description: "Test desc",
		});

		payment = await Payment.create({
			company: company._id,
			dateList: [new Date("2022-05-11")],
			totalPrice: 100,
			status: "initiated",
			events: [],
		});
	});

	describe("getPayments", () => {
		it("should retrieve all payments for admin", async () => {
			req.user = { id: admin._id.toString(), role: "admin" };
			await paymentController.getPayments(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({ success: true, count: 1 }),
			);
		});

		it("should filter payments for company users", async () => {
			req.user = { id: companyManager._id.toString(), role: "company" };
			await paymentController.getPayments(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({ count: 1 }),
			);
		});

		it("should return 404 for company user with no company", async () => {
			const anotherMngr = await User.create({
				name: "am",
				email: "am@dev.com",
				password: "password123",
				tel: "0833333333",
				role: "company",
			});
			req.user = { id: anotherMngr._id.toString(), role: "company" };
			await paymentController.getPayments(req, res);

			expect(res.status).toHaveBeenCalledWith(404);
		});

		it("should handle select, sort, pagination", async () => {
			req.user = { id: admin._id.toString(), role: "admin" };
            

            await Payment.create({
				company: company._id,
				dateList: [new Date("2022-05-12")],
				totalPrice: 100,
				status: "initiated",
				events: [],
			});

			req.query = { select: "status", sort: "totalPrice", page: "1", limit: "1" };
			await paymentController.getPayments(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                pagination: expect.objectContaining({ next: { page: 2, limit: 1 } })
            }));


            req.query = { page: "2", limit: "1", totalPrice: { gt: "50" } };
            await paymentController.getPayments(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                pagination: expect.objectContaining({ prev: { page: 1, limit: 1 } })
            }));
		});

        it("should return 500 on internal error", async () => {
			req.user = { id: admin._id.toString(), role: "admin" };
            const origCount = Payment.countDocuments;
            Payment.countDocuments = jest.fn().mockRejectedValue(new Error('DB Error'));
            
			await paymentController.getPayments(req, res);
			expect(res.status).toHaveBeenCalledWith(500);

            Payment.countDocuments = origCount;
		});
	});

	describe("getPayment", () => {
		it("should retrieve payment structure if authorized", async () => {
			req.user = { id: admin._id.toString(), role: "admin" };
			req.params.id = payment._id;
			await paymentController.getPayment(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
		});

		it("should return 404 if payment does not exist", async () => {
			req.user = { id: admin._id.toString(), role: "admin" };
			req.params.id = new mongoose.Types.ObjectId();
			await paymentController.getPayment(req, res);

			expect(res.status).toHaveBeenCalledWith(404);
		});

		it("should return 403 if user not authorized", async () => {
			const anotherUser = await User.create({
				name: "u",
				email: "u@u.com",
				password: "password123",
				tel: "0844444444",
				role: "user",
			});
			req.user = { id: anotherUser._id.toString(), role: "user" };
			req.params.id = payment._id;
			await paymentController.getPayment(req, res);

			expect(res.status).toHaveBeenCalledWith(403);
            

            const anotherMngr = await User.create({
				name: "u2",
				email: "u2@u.com",
				password: "password123",
				tel: "0855555555",
				role: "company",
			});
            req.user = { id: anotherMngr._id.toString(), role: "company" };
            await paymentController.getPayment(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
		});

        it("should return 500 on internal error", async () => {
			req.params.id = "invalid";
			await paymentController.getPayment(req, res);
			expect(res.status).toHaveBeenCalledWith(500);
		});
	});

	describe("addPayment", () => {
		it("should create a payment successfully", async () => {
			req.user = { id: admin._id.toString(), role: "admin" };
			req.params.companyId = company._id;
			req.body = { dateList: ["2022-05-10", "2022-05-11"] };

			await paymentController.addPayment(req, res);

			expect(res.status).toHaveBeenCalledWith(201);
		});

		it("should return 404 if company not found", async () => {
			req.user = { id: admin._id.toString(), role: "admin" };
			req.params.companyId = new mongoose.Types.ObjectId();
			await paymentController.addPayment(req, res);

			expect(res.status).toHaveBeenCalledWith(404);
		});

		it("should return 403 if company user attempts to add for another company", async () => {
			const anotherMngr = await User.create({
				name: "am",
				email: "am2@dev.com",
				password: "password123",
				tel: "0866666666",
				role: "company",
			});
			req.user = { id: anotherMngr._id.toString(), role: "company" };
			req.params.companyId = company._id;

			await paymentController.addPayment(req, res);

			expect(res.status).toHaveBeenCalledWith(403);
		});

		it("should return 400 if dateList is invalid or empty", async () => {
			req.user = { id: admin._id.toString(), role: "admin" };
			req.params.companyId = company._id;

			req.body = {};
			await paymentController.addPayment(req, res);
			expect(res.status).toHaveBeenCalledWith(400);

			req.body = { dateList: ["invalid"] };
			await paymentController.addPayment(req, res);
			expect(res.status).toHaveBeenCalledWith(400);

			req.body = { dateList: ["2000-01-01"] };
			await paymentController.addPayment(req, res);
			expect(res.status).toHaveBeenCalledWith(400);
		});

        it("should handle duplicate dates gracefully", async () => {
            req.user = { id: admin._id.toString(), role: "admin" };
			req.params.companyId = company._id;
			req.body = { dateList: ["2022-05-10", "2022-05-10"] };

			await paymentController.addPayment(req, res);

			expect(res.status).toHaveBeenCalledWith(201);
        });

        it("should handle ValidationError and 500 error", async () => {
            const origCreate = Payment.create;
            

            Payment.create = jest.fn().mockRejectedValue({ name: "ValidationError", errors: { c: { message: "Error" } } });
            
            req.user = { id: admin._id.toString(), role: "admin" };
			req.params.companyId = company._id;
			req.body = { dateList: ["2022-05-10"] };
			await paymentController.addPayment(req, res);
			expect(res.status).toHaveBeenCalledWith(400);


            Payment.create = jest.fn().mockRejectedValue(new Error("Unknown Error"));
            await paymentController.addPayment(req, res);
			expect(res.status).toHaveBeenCalledWith(500);

            Payment.create = origCreate;
        });
	});

	describe("updatePayment", () => {
		it("should update payment status and log event via status transition logic", async () => {
			req.user = { id: admin._id.toString(), role: "admin" };
			req.params.id = payment._id; // initiated
			req.body = { status: "authorized" };

			await paymentController.updatePayment(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			const updated = await Payment.findById(payment._id);
			expect(updated.status).toBe("authorized");
			expect(updated.events.some((e) => e.eventType === "PAYMENT_AUTHORIZED")).toBeTruthy();
		});

        it("should skip event logging if status is the same", async () => {
            req.user = { id: admin._id.toString(), role: "admin" };
			req.params.id = payment._id;
			req.body = { status: "initiated" };

			await paymentController.updatePayment(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
            const p = await Payment.findById(payment._id);
            const count = p.events.length;
            expect(count).toBe(0);
        });

		it("should emit HACKER ALERT (400) for invalid status transition", async () => {
			req.user = { id: admin._id.toString(), role: "admin" };
			req.params.id = payment._id;
			req.body = { status: "captured" };

			await paymentController.updatePayment(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({ msg: expect.stringContaining("HACKER ALERT") }),
			);
		});

        it("should cover all statusLog transitions", async () => {
			req.user = { id: admin._id.toString(), role: "admin" };
            

            const paymentNull = new Payment({ company: company._id, dateList: [new Date("2022-05-11")], totalPrice: 100, events: [] });
            paymentNull.status = null;
            await paymentNull.save({ validateBeforeSave: false });

            req.params.id = paymentNull._id;
            req.body = { status: "initiated" };
            await paymentController.updatePayment(req, res);


            await Payment.findByIdAndUpdate(paymentNull._id, { status: "authorized" });
            req.body = { status: "captured" };
            await paymentController.updatePayment(req, res);


            await Payment.findByIdAndUpdate(paymentNull._id, { status: "authorized" });
            req.body = { status: "failed" };
            await paymentController.updatePayment(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
        });

		it("should check authorization and 404", async () => {
			req.user = { id: admin._id.toString(), role: "admin" };
			req.params.id = new mongoose.Types.ObjectId();
			req.body = { status: "authorized" };
			await paymentController.updatePayment(req, res);
			expect(res.status).toHaveBeenCalledWith(404);

			const anotherUser = await User.create({
				name: "u",
				email: "u3@test.com",
				password: "password123",
				tel: "0877777777",
				role: "user",
			});
			req.user = { id: anotherUser._id.toString(), role: "user" };
			req.params.id = payment._id;
			await paymentController.updatePayment(req, res);
			expect(res.status).toHaveBeenCalledWith(403);
		});

        it("should handle Validation and Server errors", async () => {
            req.user = { id: admin._id.toString(), role: "admin" };
			req.params.id = "invalid";
			req.body = { status: "authorized" };
			await paymentController.updatePayment(req, res);
			expect(res.status).toHaveBeenCalledWith(500);


            const origFindById = Payment.findById;
            Payment.findById = jest.fn().mockResolvedValue({
                _id: payment._id,
                status: "initiated",
                events: [],
                save: jest.fn().mockRejectedValue({ name: "ValidationError", errors: { s: { message: "Validation error" } } })
            });

            req.params.id = payment._id;
			await paymentController.updatePayment(req, res);
			expect(res.status).toHaveBeenCalledWith(400);

            Payment.findById = origFindById;
        });
	});

	describe("deletePayment", () => {
		it("should cancel payment via delete request using status transition", async () => {
			req.user = { id: admin._id.toString(), role: "admin" };
			req.params.id = payment._id;

			await paymentController.deletePayment(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			const updated = await Payment.findById(payment._id);
			expect(updated.status).toBe("cancelled");
			expect(updated.events.some((e) => e.eventType === "PAYMENT_CANCELLED")).toBeTruthy();
		});

		it("should not allow cancelling captured payment", async () => {
			await Payment.findByIdAndUpdate(payment._id, { status: "captured" });

			req.user = { id: admin._id.toString(), role: "admin" };
			req.params.id = payment._id;

			await paymentController.deletePayment(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({ msg: expect.stringContaining("NO REFUNDS") }),
			);
		});

		it("should not allow cancelling cancelled or failed payment", async () => {
			await Payment.findByIdAndUpdate(payment._id, { status: "cancelled" });

			req.user = { id: admin._id.toString(), role: "admin" };
			req.params.id = payment._id;

			await paymentController.deletePayment(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({ msg: "Payment is already cancelled" }),
			);

            // Failed
            await Payment.findByIdAndUpdate(payment._id, { status: "failed" });
            await paymentController.deletePayment(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({ msg: "Payment failed, cannot cancel" }),
			);
		});

		it("should enforce authorization and check 404", async () => {
			req.user = { id: admin._id.toString(), role: "admin" };
			req.params.id = new mongoose.Types.ObjectId();
			await paymentController.deletePayment(req, res);
			expect(res.status).toHaveBeenCalledWith(404);

			const anotherUser = await User.create({
				name: "u",
				email: "u4@test.com",
				password: "password123",
				tel: "0888888888",
				role: "user",
			});
			req.user = { id: anotherUser._id.toString(), role: "user" };
			req.params.id = payment._id;
			await paymentController.deletePayment(req, res);
			expect(res.status).toHaveBeenCalledWith(403);
		});

        it("should return 500 on internal error", async () => {
			req.params.id = "invalid";
			await paymentController.deletePayment(req, res);
			expect(res.status).toHaveBeenCalledWith(500);
		});
	});
});
