// src/routes/public.listings.routes.js
const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../lib/prisma");

/**
 * Normalize listing to always expose:
 * - mainImageUrl: string | null
 * - developerName (fallback from listing fields)
 * - assignedAgent minimal info
 *
 * IMPORTANT: this assumes your ListingImage model has `url` OR `imageUrl` OR `src`.
 * If your field name is different, change pickImageUrl().
 */
function pickImageUrl(img) {
    if (!img) return null;
    return img.url || img.imageUrl || img.src || img.publicUrl || null;
}

function normalizeListing(l) {
    const firstImg = Array.isArray(l.images) && l.images.length ? l.images[0] : null;
    const mainImageUrl =
        l.mainImageUrl ||
        l.coverImageUrl ||
        l.thumbnailUrl ||
        pickImageUrl(firstImg) ||
        null;

    return {
        ...l,
        mainImageUrl,
        // keep images as-is but ensure they at least have a URL-ish field if you want
        images: Array.isArray(l.images) ? l.images : [],
    };
}

router.get("/listings", async (req, res) => {
    const qSchema = z.object({
        limit: z.string().optional(),
        country: z.string().trim().min(1).optional(),
        listingType: z.enum(["OFF_PLAN", "FOR_SALE", "FOR_RENT"]).optional(),
        featured: z.enum(["true", "false"]).optional(),
        // free text
        q: z.string().optional(),
        // agent name or slug
        agent: z.string().optional(),
    });

    const parsed = qSchema.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid query",
            details: parsed.error.flatten(),
        });
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
                // public-safe agent info (NO phone unless you explicitly want it public)
                assignedAgent: {
                    select: { id: true, fullName: true, slug: true, photoUrl: true },
                },
            },
        });

        const normalized = items.map(normalizeListing);
        res.json({ items: normalized });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to load listings" });
    }
});

module.exports = router;