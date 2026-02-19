// src/routes/admin.clientStories.routes.js
const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../lib/prisma");

const authMod = require("../middlewares/auth");
const auth = typeof authMod === "function" ? authMod : authMod.auth;
const { requireRole } = require("../middlewares/requireRole");

router.use(auth, requireRole("ADMIN"));

const CreateSchema = z.object({
    clientName: z.string().min(2),
    clientTitle: z.string().trim().nullable().optional(),
    quote: z.string().min(10),
    isHidden: z.boolean().optional(),
});

const UpdateSchema = CreateSchema.partial();

router.get("/client-stories", async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit || 300), 500);

        const items = await prisma.clientStory.findMany({
            take: limit,
            orderBy: { createdAt: "desc" },
        });

        res.json({ items });
    } catch (e) {
        console.error("GET /api/admin/client-stories failed:", e);
        res.status(500).json({ error: "Failed to load client stories" });
    }
});

router.post("/client-stories", async (req, res) => {
    try {
        const payload = CreateSchema.parse(req.body);

        const item = await prisma.clientStory.create({
            data: {
                clientName: payload.clientName.trim(),
                clientTitle: payload.clientTitle ? payload.clientTitle.trim() : null,
                quote: payload.quote.trim(),
                isHidden: !!payload.isHidden,
            },
        });

        res.json({ item });
    } catch (e) {
        console.error("POST /api/admin/client-stories failed:", e);
        if (e?.name === "ZodError") {
            return res.status(400).json({ error: e.errors?.[0]?.message || "Invalid payload" });
        }
        res.status(500).json({ error: "Failed to create client story" });
    }
});

router.patch("/client-stories/:id", async (req, res) => {
    try {
        const id = String(req.params.id || "").trim();
        if (!id) return res.status(400).json({ error: "Missing id" });

        const payload = UpdateSchema.parse(req.body);

        const data = {};
        if (payload.clientName !== undefined) data.clientName = String(payload.clientName).trim();
        if (payload.clientTitle !== undefined)
            data.clientTitle = payload.clientTitle ? String(payload.clientTitle).trim() : null;
        if (payload.quote !== undefined) data.quote = String(payload.quote).trim();
        if (payload.isHidden !== undefined) data.isHidden = !!payload.isHidden;

        const item = await prisma.clientStory.update({ where: { id }, data });

        res.json({ item });
    } catch (e) {
        console.error("PATCH /api/admin/client-stories failed:", e);
        if (e?.name === "ZodError") {
            return res.status(400).json({ error: e.errors?.[0]?.message || "Invalid payload" });
        }
        if (e?.code === "P2025") return res.status(404).json({ error: "Story not found" });
        res.status(500).json({ error: "Failed to update client story" });
    }
});

router.delete("/client-stories/:id", async (req, res) => {
    try {
        const id = String(req.params.id || "").trim();
        if (!id) return res.status(400).json({ error: "Missing id" });

        await prisma.clientStory.delete({ where: { id } });
        res.json({ ok: true });
    } catch (e) {
        console.error("DELETE /api/admin/client-stories failed:", e);
        if (e?.code === "P2025") return res.status(404).json({ error: "Story not found" });
        res.status(500).json({ error: "Failed to delete client story" });
    }
});

module.exports = router;
