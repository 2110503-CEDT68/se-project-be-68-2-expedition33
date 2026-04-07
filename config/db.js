const mongoose = require("mongoose");

const connectDB = async () => {
	mongoose.set("strictQuery", true);
	const conn = await mongoose.connect(process.env.MONGODB_URI);

	console.log(`MongoDB Connected: ${conn.connection.host}`);
};

module.exports = connectDB;
