// src/routes/public.listings.routes.js
const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../lib/prisma");

/**
 * Normalize listing to always expose:
 * - mainImageUrl: string | null
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
        images: Array.isArray(l.images) ? l.images : [],
    };
}

/**
 * Build Prisma orderBy based on query.
 * - If featured=true and sort not provided => featuredOrder ASC first
 * - sort=featuredOrder => featuredOrder ASC first
 * - sort=newest => createdAt DESC
 */
function buildOrderBy({ featured, sort }) {
    const featuredOn = featured === "true";

    const s = String(sort || "").trim().toLowerCase();
    const wantsFeaturedOrder = s === "featuredorder" || s === "featured_order" || s === "featured";

    // Default: if featured=true and no sort specified -> featured order
    if (featuredOn && !s) {
        return [{ featuredOrder: "asc" }, { createdAt: "desc" }];
    }

    if (wantsFeaturedOrder) {
        return [{ featuredOrder: "asc" }, { createdAt: "desc" }];
    }

    // newest (or default)
    return [{ createdAt: "desc" }];
}

router.get("/listings", async (req, res) => {
    const qSchema = z.object({
        limit: z.string().optional(),
        country: z.string().trim().min(1).optional(),
        listingType: z.enum(["OFF_PLAN", "FOR_SALE", "FOR_RENT"]).optional(),
        featured: z.enum(["true", "false"]).optional(),
        q: z.string().optional(),
        agent: z.string().optional(),

        // ✅ NEW
        sort: z.enum(["featuredOrder", "newest"]).optional(),
    });

    const parsed = qSchema.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid query",
            details: parsed.error.flatten(),
        });
    }

    const { limit, country, listingType, featured, q, agent, sort } = parsed.data;

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

    const orderBy = buildOrderBy({ featured, sort });

    try {
        const items = await prisma.listing.findMany({
            where,
            take,
            orderBy,
            include: {
                images: { orderBy: { order: "asc" } },
                assignedAgent: {
                    select: {
                        id: true,
                        fullName: true,
                        slug: true,
                        photoUrl: true,
                        phone: true,
                    },
                },
            },
        });

        res.json({ items: items.map(normalizeListing) });
    } catch (e) {
        console.error(e);

        /**
         * If you haven't added `featuredOrder` to Listing yet,
         * Prisma will throw "Unknown argument featuredOrder in orderBy".
         * In that case, add the column + migrate.
         */
        res.status(500).json({ error: "Failed to load listings" });
    }
});

router.get("/listings/:id", async (req, res) => {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "Missing id" });

    try {
        const item = await prisma.listing.findFirst({
            where: {
                id,
                deletedAt: null,
                isHidden: false,
            },
            include: {
                images: { orderBy: { order: "asc" } },
                assignedAgent: {
                    select: {
                        id: true,
                        fullName: true,
                        slug: true,
                        photoUrl: true,
                        phone: true,
                    },
                },
            },
        });

        if (!item) return res.status(404).json({ error: "Listing not found" });

        return res.json({ item: normalizeListing(item) });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Failed to load listing" });
    }
});

module.exports = router;