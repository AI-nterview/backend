const Joi = require('joi');

const registerSchema = Joi.object({
    name: Joi.string().min(2).max(50).optional()
        .messages({
            'string.min': 'Name must be at least {#limit} characters long.',
            'string.max': 'Name cannot be longer than {#limit} characters.'
        }),
    email: Joi.string().email({ tlds: { allow: false } }).required()
        .messages({
            'string.base': 'Email must be a string.',
            'string.empty': 'Email is required.',
            'string.email': 'Email must be a valid email address.',
            'any.required': 'Email is required.'
        }),
    password: Joi.string().min(6).required()
        .messages({
            'string.base': 'Password must be a string.',
            'string.empty': 'Password is required.',
            'string.min': 'Password must be at least {#limit} characters long.',
            'any.required': 'Password is required.'
        }),
    role: Joi.string().valid('interviewer', 'candidate').optional()
        .messages({
            'any.only': 'Role must be one of [interviewer, candidate].'
        })
});

const loginSchema = Joi.object({
    email: Joi.string().email({ tlds: { allow: false } }).required()
        .messages({
            'string.base': 'Email must be a string.',
            'string.empty': 'Email is required.',
            'string.email': 'Email must be a valid email address.',
            'any.required': 'Email is required.'
        }),
    password: Joi.string().required()
        .messages({
            'string.base': 'Password must be a string.',
            'string.empty': 'Password is required.',
            'any.required': 'Password is required.'
        })
});

module.exports = {
    registerSchema,
    loginSchema
};