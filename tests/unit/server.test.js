const app = require("../../server");
const mongoose = require("mongoose");

describe("Server Error Handling", () => {
	let exitSpy;
	let logSpy;

	beforeEach(() => {
		exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {});
		logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		exitSpy.mockRestore();
		logSpy.mockRestore();
	});

	it("should handle unhandledRejection", () => {
		// Get the unhandledRejection listener
		const listeners = process.listeners("unhandledRejection");
		const lastListener = listeners[listeners.length - 1];

		if (lastListener) {
			const mockError = new Error("Test unhandled rejection");
			lastListener(mockError, Promise.resolve());

			expect(logSpy).toHaveBeenCalledWith(
				expect.stringContaining("Error: Test unhandled rejection"),
			);
			expect(exitSpy).toHaveBeenCalledWith(1);
		}
	});
});
