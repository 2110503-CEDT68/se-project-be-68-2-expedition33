const mongoose = require("mongoose");
const Company = require("../../../models/Company");
const User = require("../../../models/User");
const Booking = require("../../../models/Booking");
const companyController = require("../../../controllers/companies");
const cloudinary = require("../../../config/cloudinary");


const { PassThrough } = require("stream");

jest.mock("../../../config/cloudinary", () => ({
	uploader: {
		upload_stream: jest.fn(),
		destroy: jest.fn().mockResolvedValue(true),
	},
}));


beforeAll(() => {
	// jest.spyOn(console, "log").mockImplementation(() => {});
});

afterAll(() => {
	// if (console.log.mockRestore) console.log.mockRestore();
});

describe("Company Controller Integration", () => {
	let req, res, manager, company;

	beforeEach(async () => {

		manager = await User.create({
			name: "Manager One",
			email: `manager1-${Date.now()}-${Math.random()}@test.com`,
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
        
        jest.clearAllMocks();

        // Re-set upload_stream with PassThrough stream so Readable.pipe() works
        cloudinary.uploader.upload_stream.mockImplementation((options, cb) => {
            const pt = new PassThrough();
            // Fire callback once data flows through
            process.nextTick(() => {
                cb(null, {
                    secure_url: "https://res.cloudinary.com/dummy.jpg",
                    public_id: "dummy_id",
                });
            });
            return pt;
        });
        cloudinary.uploader.destroy.mockResolvedValue(true);
	});

    afterEach(() => {
        jest.restoreAllMocks();
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
            const spy = jest.spyOn(Company, "countDocuments").mockRejectedValue(new Error('DB Error'));
            
            await companyController.getCompanies(req, res);
			expect(res.status).toHaveBeenCalledWith(500);
        });

		it("should populate managerAccount for Admin", async () => {
			req.user = { id: manager._id.toString(), role: "admin" };
			await companyController.getCompanies(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({
					success: true,
					data: expect.arrayContaining([
						expect.objectContaining({
							managerAccount: expect.objectContaining({
								email: expect.any(String),
							}),
						}),
					]),
				}),
			);
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

        it("should handle internal error", async () => {
            req.params.id = company._id;
            jest.spyOn(Company, "findById").mockImplementation(() => ({
                populate: jest.fn().mockReturnThis(),
                session: jest.fn().mockReturnThis(),
                then: jest.fn().mockImplementation((success, fail) => {
                    return Promise.reject(new Error("DB Fail")).catch(fail);
                })
            }));

            await companyController.getCompany(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });

		it("should populate managerAccount for Admin for single company", async () => {
			req.user = { id: manager._id.toString(), role: "admin" };
			req.params.id = company._id;
			await companyController.getCompany(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({
					success: true,
					data: expect.objectContaining({
						managerAccount: expect.objectContaining({
							email: expect.any(String),
						}),
					}),
				}),
			);
		});

		it("should return 404 if company is deleted after permission check but before final fetch", async () => {
			req.params.id = company._id;
			
			// The controller calls findById twice:
			// 1. Line 184: builds the query chain, awaited at line 208 — we want it to return null
			// 2. Line 186: await Company.findById() for companyTemp — we want it to return company
			const nullPromise = Promise.resolve(null);
			const queryMock = {
				populate: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				then: nullPromise.then.bind(nullPromise),
				catch: nullPromise.catch.bind(nullPromise),
				finally: nullPromise.finally.bind(nullPromise),
			};

			jest.spyOn(Company, "findById")
				.mockReturnValueOnce(queryMock) // First call: query chain → resolves null
				.mockResolvedValueOnce(company); // Second call: companyTemp → returns company

			await companyController.getCompany(req, res);
			expect(res.status).toHaveBeenCalledWith(404);
		});

		it("should omit managerAccount for regular user", async () => {
			req.user = { id: new mongoose.Types.ObjectId().toString(), role: "user" };
			req.params.id = company._id;
			await companyController.getCompany(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({
					success: true,
				})
			);
			
			const resData = res.json.mock.calls[0][0].data;
			expect(resData.managerAccount).toBeUndefined();
		});
	});

	describe("createCompany", () => {
		it("should generate email with counter if email already exists", async () => {
			const cleanName = "dupcomp";
			await User.create({ name: "1", email: `${cleanName}@jobfair.company`, password: "password123", tel: "0812345678", role: "company" });
			await User.create({ name: "2", email: `${cleanName}-2@jobfair.company`, password: "password123", tel: "0812345678", role: "company" });

			req.body = {
				name: "Dup Comp",
				managerTel: "0811111111",
				password: "password123",
				address: "Add",
				district: "Dist",
				province: "Prov",
				postalcode: "12345",
				tel: "0812345678",
				website: "http://dupcomp.com",
				description: "Dup desc",
			};
			req.files = null;

			await companyController.createCompany(req, res);

			expect(res.status).toHaveBeenCalledWith(201);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({ managerEmail: `${cleanName}-3@jobfair.company` })
			);
		});

		it("should create company and manager user", async () => {
			req.body = {
				name: `New Comp ${Date.now()}-${Math.random()}`,
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
		});

		it("should create company without files", async () => {
			req.body = {
				name: `No Files Comp ${Date.now()}-${Math.random()}`,
				managerTel: "0811111112",
				password: "password123",
				address: "Add",
				district: "Dist",
				province: "Prov",
				postalcode: "12345",
				tel: "0812345678",
				website: "http://test.com",
				description: "desc"
			};
			req.files = null;

			await companyController.createCompany(req, res);
			expect(res.status).toHaveBeenCalledWith(201);
		});

		it("should handle missing required fields", async () => {
			req.body = { name: "No Manager" };
			await companyController.createCompany(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
		});

        it("should handle internal server error and clean up cloudinary", async () => {
           req.body = {
				name: "New Comp Err",
				managerTel: "0844444444",
				password: "password123",
				tel: "0812345678",
			};
            req.files = { logo: [{ buffer: Buffer.from("dummy") }] };

            jest.spyOn(Company, "create").mockRejectedValue(new Error("Creation Error"));
            
            await companyController.createCompany(req, res);
			expect(res.status).toHaveBeenCalledWith(500);
            expect(cloudinary.uploader.destroy).toHaveBeenCalled();
        });

        it("should handle Cloudinary upload failure", async () => {
            req.body = { name: "Fail", managerTel: "081", password: "p123" };
            req.files = { logo: [{ buffer: Buffer.from("fail") }] };
            
            cloudinary.uploader.upload_stream.mockImplementation((options, cb) => {
                const pt = new PassThrough();
                process.nextTick(() => cb({ message: "Upload failed" }, null));
                return pt;
            });

            await companyController.createCompany(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });

        it("should handle Cloudinary upload failure with missing error object", async () => {
            req.body = { name: "Fail2", managerTel: "081", password: "p123" };
            req.files = { logo: [{ buffer: Buffer.from("fail") }] };
            
            cloudinary.uploader.upload_stream.mockImplementation((options, cb) => {
                const pt = new PassThrough();
                process.nextTick(() => cb(null, null)); // null error, null result
                return pt;
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
		});

		it("should handle cleaning up undefined and empty strings", async () => {
			req.params.id = company._id;
			req.body = { name: "Cleaned Comp", website: "", description: "undefined" };
			await companyController.updateCompany(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
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
            jest.spyOn(Company, "findByIdAndUpdate").mockRejectedValue(new Error("DB Fail"));

            await companyController.updateCompany(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
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
		});

		it("should handle deleting company without logo, photoList, or managerAccount", async () => {
			const noPhotoCompany = new Company({
				name: "No Photo Comp",
				address: "Add", district: "Dist", province: "Prov", postalcode: "12345", tel: "0812345678",
				website: "http://nophoto.com", description: "Desc"
			});
			await noPhotoCompany.save({ validateBeforeSave: false });

			req.params.id = noPhotoCompany._id;
			await companyController.deleteCompany(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
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
			jest.spyOn(Company, "findById").mockImplementation(() => { throw new Error("DB Fail"); });

			await companyController.deleteCompany(req, res);
			expect(res.status).toHaveBeenCalledWith(500);
		});
	});
});
