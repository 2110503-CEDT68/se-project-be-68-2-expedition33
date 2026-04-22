
jest.mock("../../config/cloudinary", () => ({
	uploader: {
		upload_stream: jest.fn((options, cb) => {
			cb(null, {
				secure_url: "https://cloudinary.com/system_dummy.jpg",
				public_id: "system_dummy_id",
			});
            return {
                pipe: jest.fn(),
                on: jest.fn()
            };
		}),
		destroy: jest.fn().mockResolvedValue(true),
	},
}));

const request = require("supertest");
const app = require("../../server");
const User = require("../../models/User");
const Company = require("../../models/Company");
const Booking = require("../../models/Booking");
const Payment = require("../../models/Payment");



beforeAll(async () => {
    await User.deleteMany();
    await Company.deleteMany();
    await Booking.deleteMany();
    await Payment.deleteMany();
});



describe("System E2E - User Flow", () => {
	let adminToken, userToken;
	let companyId;
    let bookingId;
    let paymentId;

	it("1. Register an Admin and a User", async () => {
		const adminRes = await request(app).post("/api/v1/auth/register").send({
			name: "System Admin",
			email: "sysadmin_e2e@test.com",
			password: "password123",
			tel: "0812345678",
			role: "admin",
		});
        
        console.log("ENUM VALUES IN MEMORY:", User.schema.path('role').enumValues);

        if (adminRes.statusCode !== 201) {
            console.error(adminRes.body);
        }
		
		expect(adminRes.statusCode).toBe(201);

        adminToken = adminRes.body.token;
		
		const userRes = await request(app).post("/api/v1/auth/register").send({
			name: "System User",
			email: "sysuser_e2e@test.com",
			password: "password123",
			tel: "0812345678",
			role: "user",
		});
		expect(userRes.statusCode).toBe(201);
		userToken = userRes.body.token;
        
        console.log("Users in DB:", await User.countDocuments());
	});

	it("2. Admin creates a Company", async () => {
		const res = await request(app)
			.post("/api/v1/companies")
			.set("Authorization", `Bearer ${adminToken}`)
			.field("name", "System Company")
			.field("managerTel", "0812345678")
			.field("password", "password123")
			.field("address", "123 Sys Rd")
			.field("district", "Sys Dist")
			.field("province", "Sys Prov")
			.field("postalcode", "12345")
			.field("tel", "0987654321")
            .field("website", "http://sys.com")
            .field("description", "System desc");
		
        if (res.statusCode !== 201) {
            console.error(res.body, adminToken);
            console.error("Users inside DB 2:", await User.countDocuments());
        }

		expect(res.statusCode).toBe(201);
		expect(res.body.success).toBe(true);
		companyId = res.body.data._id;
	});

	it("3. User makes a Booking for the Company", async () => {
		const res = await request(app)
			.post(`/api/v1/companies/${companyId}/bookings`)
			.set("Authorization", `Bearer ${userToken}`)
			.send({ bookingDate: "2022-05-11" });

		expect(res.statusCode).toBe(201);
		expect(res.body.success).toBe(true);
        bookingId = res.body.data._id;
	});

	it("4. User retrieves their Booking", async () => {
		const res = await request(app)
			.get(`/api/v1/bookings/${bookingId}`)
			.set("Authorization", `Bearer ${userToken}`);

		expect(res.statusCode).toBe(200);
		expect(res.body.data).toHaveProperty("company");
        expect(res.body.data.company._id).toBe(companyId);
	});

	it("5. Admin initiates a Payment event on the Company", async () => {
		const res = await request(app)
			.post(`/api/v1/companies/${companyId}/payments`)
			.set("Authorization", `Bearer ${adminToken}`)
			.send({
				dateList: ["2022-05-11", "2022-05-12"],
			});

		expect(res.statusCode).toBe(201);
        paymentId = res.body.data._id;
		expect(res.body.data.status).toBe("initiated");
	});

    it("6. Admin authorizes the Payment", async () => {
		const res = await request(app)
			.put(`/api/v1/payments/${paymentId}`)
			.set("Authorization", `Bearer ${adminToken}`)
			.send({ status: "authorized" });

		expect(res.statusCode).toBe(200);
		expect(res.body.data.status).toBe("authorized");
	});

    it("7. Company manager queries the payments", async () => {

        const loginRes = await request(app).post("/api/v1/auth/login").send({
			email: "systemcompany@jobfair.company",
			password: "password123",
		});
        expect(loginRes.statusCode).toBe(200);
        const managerToken = loginRes.body.token;

        const res = await request(app)
			.get("/api/v1/payments")
			.set("Authorization", `Bearer ${managerToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.count).toBe(1);
    });

	it("8. User logs out", async () => {
		const res = await request(app)
            .get("/api/v1/auth/logout")
            .set("Authorization", `Bearer ${userToken}`);

		expect(res.statusCode).toBe(200);
		expect(res.header["set-cookie"][0]).toMatch(/token=none/);
	});
});
