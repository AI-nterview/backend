const User = require('../models/User');
const Room = require('../models/Room');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { registerSchema, loginSchema } = require('../validators/authValidators');

exports.register = async (req, res) => {
    try {
        const { error, value } = registerSchema.validate(req.body, { abortEarly: false });
        if (error) {
            const errorsObject = {
                general: error.details[0].message
            };
            return res.status(400).json({ errors: errorsObject });
        }

        const { name, email, password, role, inviteToken } = value;
        const normalizedEmail = email.toLowerCase().trim();




        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            name,
            email: normalizedEmail,
            password: hashedPassword,
            role: role || 'candidate', // Если регистрируется по инвайту, скорее всего кандидат
        });
        await newUser.save();

        let joinedRoom = null;
        if (inviteToken) {
            const roomToJoin = await Room.findOne({ invitationToken: inviteToken }); // (A)

            if (roomToJoin) {
                const emailMatch = roomToJoin.candidateEmail === normalizedEmail; // (B)
                const candidateSlotAvailable = !roomToJoin.candidate; // (C)


                if (emailMatch && candidateSlotAvailable) {
                    roomToJoin.candidate = newUser._id;
                    roomToJoin.invitationToken = undefined;
                    roomToJoin.status = 'pending';
                    await roomToJoin.save();
                    joinedRoom = roomToJoin.toObject();
                } else {
                    if (!emailMatch) {
                        console.warn(`[AUTH CTRL - REGISTER] CONDITION FAIL: Email mismatch. Invited: ${roomToJoin.candidateEmail}, Registered: ${normalizedEmail}`);
                    }
                    if (!candidateSlotAvailable) {
                        console.warn(`[AUTH CTRL - REGISTER] CONDITION FAIL: Candidate slot not available. Already assigned to: ${roomToJoin.candidate}`);
                    }
                }
            }


            const payload = { userId: newUser._id, email: newUser.email, name: newUser.name, role: newUser.role };
            const authToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });


            res.status(201).json({
                message: 'User registered successfully!',
                token: authToken,
                user: {
                    id: newUser._id,
                    email: newUser.email,
                    name: newUser.name,
                    role: newUser.role
                },
                joinedRoomId: joinedRoom ? joinedRoom._id : null
            });
        }

    } catch (error) {
        res.status(500).json({ message: 'Server error during registration.' });
    }
}

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