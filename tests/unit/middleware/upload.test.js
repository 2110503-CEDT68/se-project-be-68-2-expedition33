const upload = require("../../../middleware/upload");

describe("Upload Middleware", () => {
	it("should configure multer and export an object with multer methods", () => {
		// Just ensure upload is practically configured
		expect(upload).toBeDefined();
		expect(typeof upload.single).toBe("function");
		expect(typeof upload.array).toBe("function");
		expect(typeof upload.fields).toBe("function");
	});
});
