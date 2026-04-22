const request = require("supertest");
const app = require("../../server");


beforeAll(() => {
	jest.spyOn(console, "log").mockImplementation(() => {});
});

afterAll(() => {
	console.log.mockRestore();
});

describe("System E2E - API Security", () => {
	it("should have secure Helmet headers enabled", async () => {
		const res = await request(app).get("/api/v1/companies");


		expect(res.headers["x-xss-protection"]).toBeDefined();
		expect(res.headers["content-security-policy"]).toBeDefined();
		expect(res.headers["x-frame-options"]).toBeDefined();
	});

	it("should apply rate limiting", async () => {

		const res = await request(app).get("/api/v1/companies");
		
		expect(res.headers["x-ratelimit-limit"]).toBe("100");
		expect(res.headers["x-ratelimit-remaining"]).toBeDefined();
	});

	it("should handle CORS", async () => {
		const res = await request(app).options("/api/v1/companies");
		expect(res.headers["access-control-allow-methods"]).toBeDefined();
	});
});
