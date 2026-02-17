const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");

/* =========================
   Validation
========================= */
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

/* =========================
   POST /api/auth/login
========================= */
router.post("/login", async (req, res) => {
    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid body" });
        }

        // ✅ normalize email (CRITICAL FIX)
        const email = parsed.data.email.trim().toLowerCase();
        const password = parsed.data.password;

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user || !user.isActive) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // ✅ allow ONLY admin + agent
        if (!["ADMIN", "AGENT"].includes(user.role)) {
            return res.status(403).json({ error: "Access denied" });
        }

        const token = jwt.sign(
            {
                sub: user.id,
                role: user.role,
                email: user.email,
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
        );

        return res.json({
            token,
            user: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
            },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
