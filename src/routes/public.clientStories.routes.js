// src/routes/public.clientStories.routes.js
const router = require("express").Router();
const { prisma } = require("../lib/prisma");

// GET /api/public/client-stories?limit=50
router.get("/client-stories", async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit || 50), 200);

        const items = await prisma.clientStory.findMany({
            where: { isHidden: false },
            take: limit,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                clientName: true,
                clientTitle: true,
                quote: true,
                createdAt: true,
            },
        });

        res.json({ items });
    } catch (e) {
        console.error("GET /api/public/client-stories failed:", e);
        res.status(500).json({ error: "Failed to load client stories" });
    }
});

module.exports = router;
