const mongoose = require("mongoose");
const connectDB = require("../../../config/db");

jest.mock("mongoose", () => ({
	connect: jest.fn(),
	set: jest.fn(),
}));

describe("Database Connection", () => {
	it("should connect to MongoDB", async () => {
		const mockConn = {
			connection: {
				host: "localhost",
			},
		};
		mongoose.connect.mockResolvedValue(mockConn);

		const consoleSpy = jest.spyOn(console, "log").mockImplementation();

		await connectDB();

		expect(mongoose.set).toHaveBeenCalledWith("strictQuery", true);
		expect(mongoose.connect).toHaveBeenCalled();
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("MongoDB Connected"),
		);

		consoleSpy.mockRestore();
	});
});
