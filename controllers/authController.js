const User = require('../models/User');
const Room = require('../models/Room');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { registerSchema, loginSchema } = require('../validators/authValidators');

exports.register = async (req, res) => {
    try {
        const { error, value } = registerSchema.validate(req.body, { abortEarly: false });
        if (error) {
            const errorsObject = {};
            error.details.forEach(detail => {
                const fieldName = detail.path.length > 0 ? detail.path[0] : 'general';
                if (!errorsObject[fieldName]) {
                    errorsObject[fieldName] = [];
                }
                errorsObject[fieldName].push(detail.message);
            });
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
            role: role || 'candidate',
        });
        await newUser.save();
        console.log('New user saved:', newUser._id);


        let joinedRoomInfo = null;
        if (inviteToken) {
            console.log('[AUTH CTRL - REGISTER] Processing inviteToken:', inviteToken); // Лог 1
            const roomToJoin = await Room.findOne({ invitationToken: inviteToken });

            if (roomToJoin) {
                console.log('[AUTH CTRL - REGISTER] Found room by inviteToken:', roomToJoin._id, 'Candidate email in room:', roomToJoin.candidateEmail); // Лог 2
                const emailMatch = roomToJoin.candidateEmail === normalizedEmail;
                const candidateSlotAvailable = !roomToJoin.candidate; // Проверяем, что поле candidate еще не занято

                console.log(`[AUTH CTRL - REGISTER] Conditions - emailMatch: ${emailMatch} (Room: ${roomToJoin.candidateEmail}, User: ${normalizedEmail}), candidateSlotAvailable: ${candidateSlotAvailable}`); // Лог 3

                if (emailMatch && candidateSlotAvailable) {
                    roomToJoin.candidate = newUser._id;
                    roomToJoin.invitationToken = undefined;
                    roomToJoin.status = 'pending';
                    await roomToJoin.save();
                    joinedRoomInfo = { id: roomToJoin._id, status: roomToJoin.status };
                    console.log('[AUTH CTRL - REGISTER] User joined room, room updated:', roomToJoin._id, 'New status:', roomToJoin.status); // Лог 4
                } else {
                    if (!emailMatch) {
                        console.warn(`[AUTH CTRL - REGISTER] CONDITION FAIL: Email mismatch. Invited: ${roomToJoin.candidateEmail}, Registered: ${normalizedEmail}`);
                    }
                    if (!candidateSlotAvailable) {
                        console.warn(`[AUTH CTRL - REGISTER] CONDITION FAIL: Candidate slot not available. Already assigned to: ${roomToJoin.candidate}`);
                    }
                    // Важно: если условия не выполнены, комната не обновляется, и у пользователя (кандидата) не будет информации о присоединенной комнате.
                    // Возможно, стоит вернуть ошибку или специальное сообщение кандидату, если, например, email не совпал.
                }
            } else {
                console.warn(`[AUTH CTRL - REGISTER] Invite token ${inviteToken} not found or room does not exist.`);
            }
        }

        const payload = { userId: newUser._id, email: newUser.email, name: newUser.name, role: newUser.role };
        const authToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        console.log('Sending success response for user:', newUser._id);
        res.status(201).json({
            message: 'User registered successfully!',
            token: authToken,
            user: {
                id: newUser._id,
                email: newUser.email,
                name: newUser.name,
                role: newUser.role,
            },
            ...(joinedRoomInfo && { joinedRoomId: joinedRoomInfo.id })
        });

    } catch (error) {
        console.error('Server error during registration:', error);
        res.status(500).json({ message: 'Server error during registration. Please check logs.' });
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

        const { email, password, name } = value;

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

        const payload = {
            userId: user._id,
            email: user.email,
            name: user.name,
            role: user.role
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

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