// src/routes/leads.routes.js
const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../lib/prisma");

// ✅ auth can be exported as:
// module.exports = auth
// OR module.exports = { auth, requireRole }
const authMod = require("../middlewares/auth");
const auth = typeof authMod === "function" ? authMod : authMod.auth;

// ✅ requireRole can exist in:
// - ../middlewares/requireRole (module.exports = { requireRole })
// - OR inside ../middlewares/auth (module.exports = { auth, requireRole })
let requireRole = null;

try {
    const rrMod = require("../middlewares/requireRole");
    requireRole = typeof rrMod === "function" ? rrMod : rrMod.requireRole;
} catch {
    // ignore, fallback to auth.js export if present
    requireRole = typeof authMod === "object" ? authMod.requireRole : null;
}

// safety checks (gives you a clear crash reason instead of "handler must be a function")
if (typeof auth !== "function") {
    throw new Error(
        "middlewares/auth export is not a function. Export it as module.exports = auth OR module.exports = { auth, requireRole }."
    );
}
if (typeof requireRole !== "function") {
    throw new Error(
        "requireRole must export { requireRole } as a function (either in middlewares/requireRole.js or middlewares/auth.js)."
    );
}

/* =========================
   Schemas
========================= */
const LeadUpdateSchema = z.object({
    status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "CLOSED", "SPAM"]).optional(),
    note: z.string().nullable().optional(),
    assignedAgentId: z.string().nullable().optional(), // admin only
});

/* =========================
   GET /api/leads
========================= */
router.get("/", auth, requireRole("ADMIN", "AGENT"), async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit || 200), 500);

        const where = req.user?.role === "AGENT" ? { assignedAgentId: req.user.id } : {};

        const items = await prisma.lead.findMany({
            where,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                listing: { select: { id: true, title: true } },
                assignedAgent: { select: { id: true, fullName: true, email: true, phone: true } },
            },
        });

        res.json({ items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load leads" });
    }
});

/* =========================
   PATCH /api/leads/:id
========================= */
router.patch("/:id", auth, requireRole("ADMIN", "AGENT"), async (req, res) => {
    try {
        const id = req.params.id;
        const parsed = LeadUpdateSchema.parse(req.body);

        const lead = await prisma.lead.findUnique({ where: { id } });
        if (!lead) return res.status(404).json({ error: "Lead not found" });

        if (req.user.role === "AGENT" && lead.assignedAgentId !== req.user.id) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const data = {
            status: parsed.status ?? undefined,
            note: parsed.note ?? undefined,
        };

        if (req.user.role === "ADMIN") {
            data.assignedAgentId = parsed.assignedAgentId ?? undefined;
        }

        const updated = await prisma.lead.update({
            where: { id },
            data,
            include: {
                listing: { select: { id: true, title: true } },
                assignedAgent: { select: { id: true, fullName: true, email: true, phone: true } },
            },
        });

        res.json({ item: updated });
    } catch (err) {
        console.error(err);
        if (err?.name === "ZodError") {
            return res.status(400).json({ error: err.errors?.[0]?.message || "Invalid payload" });
        }
        res.status(500).json({ error: "Failed to update lead" });
    }
});

module.exports = router;