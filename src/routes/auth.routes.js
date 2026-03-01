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
const { auth, requireRole } = require("../middlewares/auth");

const changePasswordSchema = z.object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(8),
});

router.post("/change-password", auth, requireRole("ADMIN", "AGENT"), async (req, res) => {
    try {
        const parsed = changePasswordSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid body" });
        }

        const { currentPassword, newPassword } = parsed.data;

        if (currentPassword === newPassword) {
            return res.status(400).json({ error: "New password must be different" });
        }

        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: "Unauthenticated" });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, passwordHash: true, isActive: true },
        });

        if (!user || !user.isActive) {
            return res.status(401).json({ error: "Unauthenticated" });
        }

        const ok = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!ok) {
            return res.status(401).json({ error: "Invalid current password" });
        }

        const saltRounds = Number(process.env.BCRYPT_ROUNDS || 10);
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);

        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash },
        });

        return res.json({ ok: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
});
module.exports = router;
