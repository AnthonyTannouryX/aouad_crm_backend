// src/routes/public.leads.routes.js
const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../lib/prisma");

/**
 * Public endpoint used by the website "Schedule a Call" form.
 * Creates a Lead row, auto-assigning to:
 *  - agentId in payload, OR
 *  - listing.assignedAgentId if listingId is provided, OR
 *  - null (unassigned)
 */
const ScheduleCallSchema = z.object({
    listingId: z.string().optional(),
    agentId: z.string().optional(),

    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),

    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().min(6, "Phone is required"),

    note: z.string().optional().or(z.literal("")),
    pageUrl: z.string().optional(),
});

router.post("/leads/schedule-call", async (req, res) => {
    try {
        const parsed = ScheduleCallSchema.parse(req.body);

        // Optional: validate listing + read assigned agent from listing
        let listing = null;
        if (parsed.listingId) {
            listing = await prisma.listing.findUnique({
                where: { id: parsed.listingId },
                select: { id: true, assignedAgentId: true },
            });

            if (!listing) {
                return res.status(404).json({ error: "Listing not found" });
            }
        }

        const assignedAgentId = parsed.agentId || listing?.assignedAgentId || null;

        // Keep IP short + robust behind proxies
        const xfwd = req.headers["x-forwarded-for"];
        const ip =
            (Array.isArray(xfwd) ? xfwd[0] : xfwd?.split(",")[0]) ||
            req.socket?.remoteAddress ||
            null;

        const lead = await prisma.lead.create({
            data: {
                firstName: parsed.firstName.trim(),
                lastName: parsed.lastName.trim(),
                email: parsed.email ? String(parsed.email).trim() : null,
                phone: String(parsed.phone).trim(),
                note: parsed.note ? String(parsed.note).trim() : null,

                source: "WEBSITE",
                status: "NEW",

                listingId: listing?.id || parsed.listingId || null,
                assignedAgentId,

                pageUrl: parsed.pageUrl ? String(parsed.pageUrl).slice(0, 1000) : null,
                userAgent: req.get("user-agent") || null,
                ip: ip ? String(ip).slice(0, 64) : null,
            },
            select: { id: true },
        });

        return res.json({ ok: true, leadId: lead.id });
    } catch (err) {
        console.error(err);
        if (err?.name === "ZodError") {
            return res
                .status(400)
                .json({ error: err.errors?.[0]?.message || "Invalid payload" });
        }
        return res.status(500).json({ error: "Failed to submit lead" });
    }
});

module.exports = router;