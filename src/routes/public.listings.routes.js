// src/routes/public.listings.routes.js
const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../lib/prisma");

router.get("/listings", async (req, res) => {
    const qSchema = z.object({
        limit: z.string().optional(),
        country: z.string().trim().min(1).optional(),
        listingType: z.enum(["OFF_PLAN", "FOR_SALE", "FOR_RENT"]).optional(),
        featured: z.enum(["true", "false"]).optional(),
        // ✅ NEW:
        q: z.string().optional(),          // free text
        agent: z.string().optional(),      // agent name or slug
    });

    const parsed = qSchema.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
    }

    const { limit, country, listingType, featured, q, agent } = parsed.data;

    const take = limit ? Math.max(1, Math.min(800, Number(limit))) : 100;
    const countryKey = country ? String(country).toLowerCase() : null;

    const qText = String(q || "").trim();
    const agentText = String(agent || "").trim();

    const where = {
        deletedAt: null,
        isHidden: false,
        ...(countryKey ? { country: { equals: countryKey } } : {}),
        ...(listingType ? { listingType } : {}),
        ...(featured ? { featured: featured === "true" } : {}),
        ...(qText
            ? {
                OR: [
                    { title: { contains: qText, mode: "insensitive" } },
                    { city: { contains: qText, mode: "insensitive" } },
                    { area: { contains: qText, mode: "insensitive" } },
                    { community: { contains: qText, mode: "insensitive" } },
                    { developerName: { contains: qText, mode: "insensitive" } },
                    { projectName: { contains: qText, mode: "insensitive" } },
                    { locationLabel: { contains: qText, mode: "insensitive" } },
                ],
            }
            : {}),
        ...(agentText
            ? {
                assignedAgent: {
                    OR: [
                        { fullName: { contains: agentText, mode: "insensitive" } },
                        { slug: { contains: agentText, mode: "insensitive" } },
                    ],
                },
            }
            : {}),
    };

    try {
        const items = await prisma.listing.findMany({
            where,
            take,
            orderBy: { createdAt: "desc" },
            include: {
                images: { orderBy: { order: "asc" } },
                // ✅ expose only safe agent info publicly
                assignedAgent: { select: { id: true, fullName: true, slug: true, photoUrl: true } },
            },
        });

        res.json({ items });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to load listings" });
    }
});

module.exports = router;
