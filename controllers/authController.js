const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { registerSchema, loginSchema } = require('../validators/authValidators');

exports.register = async (req, res) => {
    try {
        // validate request body
        const { error, value } = registerSchema.validate(req.body, { abortEarly: false });
        if (error) {
            const errorsObject = {};
            error.details.forEach(detail => {
                const fieldName = detail.path.length > 0 ? detail.path[0] : 'general';
                if (!errorsObject[fieldName]) {
                    errorsObject[fieldName] = detail.message;
                }
            });
            return res.status(400).json({ errors: errorsObject });
        }

        const { name, email, password, role } = value;

        // check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'user with this email already exists.' });
        }

        // hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: role || 'interviewer' // default role
        });

        await newUser.save();

        res.status(201).json({
            message: 'user registered successfully!',
            userId: newUser._id,
            email: newUser.email,
            role: newUser.role
        });

    } catch (error) {
        console.error('error during registration:', error);
        res.status(500).json({ message: 'server error during registration.' });
    }
};

exports.login = async (req, res) => {
    try {
        // validate request body
        const { error, value } = loginSchema.validate(req.body, { abortEarly: false });
        if (error) {
            const errorsObject = {};
            error.details.forEach(detail => {
                const fieldName = detail.path.length > 0 ? detail.path[0] : 'general';
                if (!errorsObject[fieldName]) {
                    errorsObject[fieldName] = detail.message;
                }
            });
            return res.status(400).json({ errors: errorsObject });
        }

        const { email, password } = value;

        // find user by email
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ message: 'invalid credentials.' });
        }

        // compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'invalid credentials.' });
        }

        // generate jwt token
        const payload = {
            userId: user._id,
            email: user.email,
            role: user.role
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({
            message: 'login successful!',
            token: token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });

    } catch (error) {
        console.error('error during login:', error);
        res.status(500).json({ message: 'server error during login.' });
    }
};