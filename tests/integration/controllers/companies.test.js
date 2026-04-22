const mongoose = require("mongoose");
const Company = require("../../../models/Company");
const User = require("../../../models/User");
const Booking = require("../../../models/Booking");
const companyController = require("../../../controllers/companies");
const cloudinary = require("../../../config/cloudinary");


jest.mock("../../../config/cloudinary", () => ({
	uploader: {
		upload_stream: jest.fn((options, cb) => {
			if (options.folder === "jobfair/error" || options.triggerError) {
                return cb(new Error("Cloudinary error"), null);
            }
			cb(null, {
				secure_url: "https://res.cloudinary.com/dummy.jpg",
				public_id: "dummy_id",
			});
            return {
                pipe: jest.fn().mockReturnThis(),
                on: jest.fn().mockReturnThis(),
                write: jest.fn(),
                end: jest.fn()
            };
		}),
		destroy: jest.fn().mockResolvedValue(true),
	},
}));


beforeAll(() => {
	jest.spyOn(console, "log").mockImplementation(() => {});
});

afterAll(() => {
	console.log.mockRestore();
});

describe("Company Controller Integration", () => {
	let req, res, manager, company;

	beforeEach(async () => {

		manager = await User.create({
			name: "Manager One",
			email: "manager1@test.com",
			password: "password123",
			tel: "0812345678",
			role: "company",
		});


		company = await Company.create({
			name: "Test Company",
			address: "Add",
			district: "Dist",
			province: "Prov",
			postalcode: "12345",
			tel: "0812345678",
			website: "http://test.com",
			description: "Test desc",
			logo: { url: "https://res.cloudinary.com/test.jpg", public_id: "test_id" },
			managerAccount: manager._id,
		});

		req = {
			params: {},
			query: {},
			body: {},
			user: { id: manager._id.toString(), role: "company" },
			files: {},
		};

		res = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn().mockReturnThis(),
		};
	});

	describe("getCompanies", () => {
		it("should retrieve all companies", async () => {
			await companyController.getCompanies(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({
					success: true,
					count: expect.any(Number),
					data: expect.any(Array),
				}),
			);
		});

		it("should handle select, sort, pagination", async () => {

            await Company.create({
                name: "Test Company 2",
                address: "Add2",
                district: "Dist2",
                province: "Prov2",
                postalcode: "12345",
                tel: "0812345678",
                website: "http://test2.com",
                description: "Test desc 2",
                managerAccount: new mongoose.Types.ObjectId()
            });

			req.query = { select: "name", sort: "name", page: "1", limit: "1" };
			await companyController.getCompanies(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                pagination: expect.objectContaining({ next: expect.any(Object) })
            }));


            req.query = { page: "2", limit: "1", name: { in: "Test" } };
            await companyController.getCompanies(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                pagination: expect.objectContaining({ prev: expect.any(Object) })
            }));
		});

        it("should handle error 500", async () => {
            const origCount = Company.countDocuments;
            Company.countDocuments = jest.fn().mockRejectedValue(new Error('DB Error'));
            
            await companyController.getCompanies(req, res);
			expect(res.status).toHaveBeenCalledWith(500);

            Company.countDocuments = origCount;
        });
	});

	describe("getCompany", () => {
		it("should retrieve single company", async () => {
			req.params.id = company._id;
			await companyController.getCompany(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({
					success: true,
					data: expect.objectContaining({ name: "Test Company" }),
				}),
			);
		});

		it("should return 404 if company not found", async () => {
			req.params.id = new mongoose.Types.ObjectId();
			await companyController.getCompany(req, res);

			expect(res.status).toHaveBeenCalledWith(404);
		});

		it("should return 400 for invalid ID (CastError)", async () => {
			req.params.id = "invalidId";
			await companyController.getCompany(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
		});

        it("should return 500 on internal error", async () => {
            req.params.id = company._id;
            const orig = Company.findById;
            Company.findById = jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                exec: jest.fn().mockRejectedValue(new Error("DB Fail"))
            });


            
            Company.findById = jest.fn().mockImplementation(() => ({
                populate: jest.fn().mockReturnThis(),
                then: jest.fn().mockImplementation((success, fail) => {
                    return Promise.reject(new Error("DB Fail")).catch(fail);
                })
            }));

            await companyController.getCompany(req, res);
            expect(res.status).toHaveBeenCalledWith(500);

            Company.findById = orig;
        });
	});

	describe("createCompany", () => {
		it("should create company and manager user", async () => {
			req.body = {
				name: "New Comp !@#",
				managerTel: "0811111111",
				password: "password123",
				address: "Add",
				district: "Dist",
				province: "Prov",
				postalcode: "12345",
				tel: "0812345678",
				website: "http://newcomp.com",
				description: "New Comp Desc",
                someNullField: "null"
			};
			req.files = {
				logo: [{ buffer: Buffer.from("dummy") }],
				photoList: [{ buffer: Buffer.from("dummy2") }],
			};

			await companyController.createCompany(req, res);

			expect(res.status).toHaveBeenCalledWith(201);
			const newComp = await Company.findOne({ name: "New Comp !@#" });
			expect(newComp).toBeTruthy();
			expect(newComp.logo.url).toBe("https://res.cloudinary.com/dummy.jpg");

			const newManager = await User.findOne({ email: "newcomp@jobfair.company" });
			expect(newManager).toBeTruthy();
		});

		it("should handle missing required fields", async () => {
			req.body = { name: "No Manager" };
			await companyController.createCompany(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
		});

		it("should handle duplicate manager email", async () => {
			await User.create({
				name: "Existing",
				email: "duplicate@jobfair.company",
				password: "password123",
				tel: "0822222222",
			});

			req.body = {
				name: "Duplicate",
				managerTel: "0812345678",
				password: "password123",
				website: "http://duplicate.com",
				description: "Duplicate Desc",
			};

			await companyController.createCompany(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
		});

        it("should handle internal server error and clean up cloudinary", async () => {
           req.body = {
				name: "New Comp",
				managerTel: "0844444444",
				password: "password123",
				address: "Add",
				district: "Dist",
				province: "Prov",
				postalcode: "12345",
				tel: "0812345678",
			};
            req.files = { logo: [{ buffer: Buffer.from("dummy") }] };

            const origCreate = Company.create;
            Company.create = jest.fn().mockRejectedValue(new Error("Creation Error"));
            
            await companyController.createCompany(req, res);
			expect(res.status).toHaveBeenCalledWith(500);
            expect(cloudinary.uploader.destroy).toHaveBeenCalled();

            Company.create = origCreate;
        });

        it("should handle Cloudinary upload failure", async () => {
            req.body = { name: "Fail", managerTel: "081", password: "p123" };
            req.files = { logo: [{ buffer: Buffer.from("fail") }] };
            
            cloudinary.uploader.upload_stream.mockImplementationOnce((options, cb) => {
                cb({ message: "Upload failed" }, null);
                return { pipe: jest.fn() };
            });

            await companyController.createCompany(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
	});

	describe("updateCompany", () => {
		it("should update company successfully", async () => {
			req.params.id = company._id;
			req.body = { name: "Updated Comp" };
            req.files = {
                logo: [{ buffer: Buffer.from("dummy") }]
            };

			await companyController.updateCompany(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			const updated = await Company.findById(company._id);
			expect(updated.name).toBe("Updated Comp");
		});

		it("should handle cleaning up undefined and empty strings", async () => {
			req.params.id = company._id;
			req.body = { name: "Cleaned Comp", website: "", description: "undefined" };
			await companyController.updateCompany(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			const updated = await Company.findById(company._id);
			expect(updated.name).toBe("Cleaned Comp");
		});

		it("should return 404 if company not found", async () => {
			req.params.id = new mongoose.Types.ObjectId();
			req.body = { name: "Fail" };
			await companyController.updateCompany(req, res);

			expect(res.status).toHaveBeenCalledWith(404);
		});

		it("should handle CastError", async () => {
			req.params.id = "invalid";
			await companyController.updateCompany(req, res);
			expect(res.status).toHaveBeenCalledWith(400);
		});

		it("should handle ValidationError", async () => {
			req.params.id = company._id;
			req.body = { website: "invalid-url" };
			await companyController.updateCompany(req, res);
			expect(res.status).toHaveBeenCalledWith(400);
		});

        it("should handle internal error", async () => {
            req.params.id = company._id;
            const orig = Company.findByIdAndUpdate;
            Company.findByIdAndUpdate = jest.fn().mockRejectedValue(new Error("DB Fail"));

            await companyController.updateCompany(req, res);
            expect(res.status).toHaveBeenCalledWith(500);

            Company.findByIdAndUpdate = orig;
        });
	});

	describe("deleteCompany", () => {
		it("should delete company and associated data", async () => {

            await Company.findByIdAndUpdate(company._id, {
                photoList: [{ url: "p1.jpg", public_id: "p1_id" }]
            });

			req.params.id = company._id;
			await companyController.deleteCompany(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(cloudinary.uploader.destroy).toHaveBeenCalled();

			const deleted = await Company.findById(company._id);
			expect(deleted).toBeNull();
		});

		it("should return 404 if company not found", async () => {
			req.params.id = new mongoose.Types.ObjectId();
			await companyController.deleteCompany(req, res);

			expect(res.status).toHaveBeenCalledWith(404);
		});

		it("should handle CastError", async () => {
			req.params.id = "invalid";
			await companyController.deleteCompany(req, res);
			expect(res.status).toHaveBeenCalledWith(400);
		});

		it("should handle internal error", async () => {
			req.params.id = company._id;
			const orig = Company.findById;
			Company.findById = jest.fn().mockImplementation(() => { throw new Error("DB Fail"); });

			await companyController.deleteCompany(req, res);
			expect(res.status).toHaveBeenCalledWith(500);

			Company.findById = orig;
		});
	});
});
