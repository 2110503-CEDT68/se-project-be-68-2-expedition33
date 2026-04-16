const User = require("../models/User");
const Company = require("../models/Company");

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
	// Create token
	const token = user.getSignedJwtToken();

	const options = {
		expires: new Date(
			Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000,
		),
		httpOnly: true,
	};

	if (process.env.NODE_ENV === "production") {
		options.secure = true;
	}

	res.status(statusCode).cookie("token", token, options).json({
		success: true,
		token,
	});
};

//@desc		Register user
//@route	POST /api/v1/auth/register
//@access	Public
exports.register = async (req, res) => {
	try {
		const { name, email, password, tel, role } = req.body;

		// Create user to the database
		const user = await User.create({
			name,
			email,
			password,
			tel,
			role,
		});

		sendTokenResponse(user, 201, res);
	} catch (err) {
		if (err.name === "ValidationError")
			return res.status(400).json({ success: false, msg: err.message });
		if (err.code === 11000)
			return res.status(400).json({
				success: false,
				msg: "User with this email already exists",
			});
		res.status(500).json({ success: false });
	}
};

//@desc		Login user
//@route	POST /api/v1/auth/login
//@access	Public
exports.login = async (req, res) => {
	const { email, password } = req.body;

	// Validate email & password
	if (!email || !password) {
		return res
			.status(400)
			.json({ success: false, msg: "Please provide an email and password" });
	}

	// Check for user
	const user = await User.findOne({ email }).select("+password");
	if (!user) {
		return res.status(400).json({ success: false, msg: "Invalid credentials" });
	}

	// Check if password matches
	const isMatch = await user.matchPassword(password);
	if (!isMatch) {
		return res.status(400).json({ success: false, msg: "Invalid credentials" });
	}

	sendTokenResponse(user, 200, res);
};

//@desc		Get current logged in user
//@route	GET /api/v1/auth/me
//@access	Private
exports.getMe = async (req, res, next) => {
	try {
		// Fetch the raw Mongoose Document
		const userDoc = await User.findById(req.user.id);

		if (!userDoc) {
			return res.status(404).json({ success: false, msg: "User not found" });
		}

		// Convert to a plain JavaScript object.
		const user = userDoc.toObject();

		if (user.role === "company") {
			const companyDoc = await Company.findOne({
				managerAccount: user._id,
			}).select("-managerAccount");

			user.companyData = companyDoc ? companyDoc.toObject() : null;
		}

		res.status(200).json({
			success: true,
			data: user,
		});
	} catch (err) {
		res.status(500).json({ success: false, msg: "Server Error" });
		console.log(err);
	}
};

//@desc		Log user out / clear cookie
//@route	GET /api/v1/auth/logout
//@access	Private
exports.logout = async (req, res, next) => {
	res.cookie("token", "none", {
		expires: new Date(Date.now() + 10 * 1000),
		httpOnly: true,
	});

	res.status(200).json({
		success: true,
		data: {},
	});
};
