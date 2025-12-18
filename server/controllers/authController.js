const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const { z } = require('zod');

// Schéma de validation avec Zod
const registerSchema = z.object({
    username: z.string().min(3).max(20),
    email: z.string().email(),
    password: z.string()
        .min(8, "Password too short")
        .regex(/[A-Z]/, "Need uppercase")
        .regex(/[0-9]/, "Need number")
        .regex(/[^A-Za-z0-9]/, "Need special char"), // Empêche les mots simples du dictionnaire
    firstName: z.string().min(2),
    lastName: z.string().min(2),
});

exports.register = async (req, res) => {
    try {
        // 1. Validation des inputs
        const validatedData = registerSchema.parse(req.body);

        // 2. Vérifier si existe déjà
        const existingEmail = await User.findByEmail(validatedData.email);
        if (existingEmail) return res.status(400).json({ error: 'Email already exists' });

        const existingUser = await User.findByUsername(validatedData.username);
        if (existingUser) return res.status(400).json({ error: 'Username already taken' });

        // 3. Hashage du mot de passe
        const hashedPassword = await bcrypt.hash(validatedData.password, 10);

        // 4. Création en DB
        const newUser = await User.createUser({
            ...validatedData,
            password: hashedPassword
        });

        // TODO: Envoyer l'email de confirmation ici (Bonus/Mandatory step later)
        console.log(`✉️ Email verification sent to ${newUser.email}`);

        res.status(201).json({ message: 'User created. Please verify your email.', user: newUser });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // 1. Chercher l'user
        const user = await User.findByUsername(username);
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        // 2. Vérifier mot de passe
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

        // 3. Générer JWT
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, user: { id: user.id, username: user.username, email: user.email } });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
