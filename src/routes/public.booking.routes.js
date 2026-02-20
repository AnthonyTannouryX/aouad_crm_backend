// src/routes/public.booking.routes.js
const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../lib/prisma");

/* =========================================================
   Helpers
========================================================= */

function hhmmToMinutes(hhmm) {
    const [hh, mm] = String(hhmm || "00:00").split(":").map((x) => Number(x));
    return (Number.isFinite(hh) ? hh : 0) * 60 + (Number.isFinite(mm) ? mm : 0);
}

function minutesToHHMM(m) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    return `${hh}:${mm}`;
}

// Build a UTC Date from a local date "YYYY-MM-DD" + HH:MM and a tz offset (minutes)
// Example: Beirut is typically +120 => tzOffsetMin = 120
function localDateTimeToUTC(dateStr, hhmm, tzOffsetMin) {
    const [y, mo, d] = String(dateStr).split("-").map(Number);
    const mins = hhmmToMinutes(hhmm);

    // This constructs a UTC timestamp representing "local time"
    // then subtract offset to convert to true UTC.
    const utcMs = Date.UTC(y, (mo || 1) - 1, d || 1, 0, 0, 0) + mins * 60_000;
    const trueUtcMs = utcMs - (Number(tzOffsetMin) || 0) * 60_000;
    return new Date(trueUtcMs);
}

function getLocalDayOfWeek(dateStr) {
    // dateStr is "YYYY-MM-DD"
    const [y, mo, d] = String(dateStr).split("-").map(Number);
    // Use UTC noon to avoid DST edge weirdness
    const dt = new Date(Date.UTC(y, (mo || 1) - 1, d || 1, 12, 0, 0));
    // getUTCDay() gives 0..6 same as local day mapping we use
    return dt.getUTCDay();
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
}

/* =========================================================
   ✅ Public: Get agent availability slots for a given date
   GET /api/public/agents/:slug/availability?date=YYYY-MM-DD&tzOffsetMin=120&durationMin=30
========================================================= */
router.get("/agents/:slug/availability", async (req, res) => {
    try {
        const qSchema = z.object({
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            tzOffsetMin: z.string().optional(),
            durationMin: z.string().optional(),
        });

        const parsed = qSchema.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid query" });
        }

        const { date, tzOffsetMin, durationMin } = parsed.data;
        const dur = Math.max(15, Math.min(240, Number(durationMin || 30) || 30));
        const offset = Number(tzOffsetMin || 0) || 0;

        const agent = await prisma.user.findFirst({
            where: { role: "AGENT", isActive: true, slug: req.params.slug },
            select: { id: true, fullName: true, slug: true },
        });
        if (!agent) return res.status(404).json({ error: "Agent not found" });

        const dayOfWeek = getLocalDayOfWeek(date);

        const sched = await prisma.agentSchedule.findFirst({
            where: { agentId: agent.id, dayOfWeek },
            select: { startHHMM: true, endHHMM: true, slotMin: true },
        });

        if (!sched) {
            return res.json({
                agent,
                date,
                dayOfWeek,
                slots: [],
                note: "No availability for this day.",
            });
        }

        const slotMin = Math.max(10, Math.min(240, Number(sched.slotMin) || 30));
        const startM = hhmmToMinutes(sched.startHHMM);
        const endM = hhmmToMinutes(sched.endHHMM);

        if (endM <= startM) {
            return res.json({ agent, date, dayOfWeek, slots: [] });
        }

        // Pull all appointments for that local day window (converted to UTC)
        const dayStartUTC = localDateTimeToUTC(date, "00:00", offset);
        const dayEndUTC = localDateTimeToUTC(date, "23:59", offset);

        const appts = await prisma.appointment.findMany({
            where: {
                agentId: agent.id,
                status: { in: ["PENDING", "CONFIRMED"] },
                startAt: {
                    gte: dayStartUTC,
                    lte: dayEndUTC,
                },
            },
            select: { startAt: true, durationMin: true },
            orderBy: { startAt: "asc" },
        });

        // Build candidate slots in LOCAL time, then validate by overlap in UTC
        const slots = [];
        for (let m = startM; m + dur <= endM; m += slotMin) {
            const hhmm = minutesToHHMM(m);
            const slotStartUTC = localDateTimeToUTC(date, hhmm, offset);
            const slotEndUTC = new Date(slotStartUTC.getTime() + dur * 60_000);

            const blocked = appts.some((a) => {
                const aStart = new Date(a.startAt);
                const aEnd = new Date(aStart.getTime() + (Number(a.durationMin) || 30) * 60_000);
                return rangesOverlap(slotStartUTC, slotEndUTC, aStart, aEnd);
            });

            if (!blocked) {
                slots.push({
                    labelLocal: hhmm,
                    startAtUtc: slotStartUTC.toISOString(),
                    durationMin: dur,
                });
            }
        }

        res.json({
            agent,
            date,
            dayOfWeek,
            schedule: sched,
            slots,
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to load availability" });
    }
});

/* =========================================================
   ✅ Public: Book an appointment + create Lead
   POST /api/public/agents/:slug/book
========================================================= */
const BookSchema = z.object({
    // pick one slot from availability response
    startAtUtc: z.string().min(10),
    durationMin: z.number().int().min(15).max(240).default(30),

    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email().optional().or(z.literal("")).nullable(),
    phone: z.string().min(6),
    note: z.string().max(4000).optional().or(z.literal("")).nullable(),

    listingId: z.string().optional(),
    pageUrl: z.string().optional(),
});

router.post("/agents/:slug/book", async (req, res) => {
    try {
        const parsed = BookSchema.parse(req.body);

        const agent = await prisma.user.findFirst({
            where: { role: "AGENT", isActive: true, slug: req.params.slug },
            select: { id: true, fullName: true, slug: true },
        });
        if (!agent) return res.status(404).json({ error: "Agent not found" });

        const startAt = new Date(parsed.startAtUtc);
        if (Number.isNaN(startAt.getTime())) {
            return res.status(400).json({ error: "Invalid startAtUtc" });
        }

        // Optional: verify listing exists if provided
        let listing = null;
        if (parsed.listingId) {
            listing = await prisma.listing.findUnique({
                where: { id: parsed.listingId },
                select: { id: true },
            });
            if (!listing) return res.status(404).json({ error: "Listing not found" });
        }

        const durationMin = Number(parsed.durationMin) || 30;
        const endAt = new Date(startAt.getTime() + durationMin * 60_000);

        // Prevent double-book (race-safe enough for low traffic; for high traffic use DB constraint/transaction locks)
        const overlap = await prisma.appointment.findFirst({
            where: {
                agentId: agent.id,
                status: { in: ["PENDING", "CONFIRMED"] },
                startAt: { lt: endAt },
                // any appointment that ends after this start
                // (we can't query endAt directly, so we filter wide and check in JS)
            },
            select: { id: true, startAt: true, durationMin: true },
        });

        if (overlap) {
            const oStart = new Date(overlap.startAt);
            const oEnd = new Date(oStart.getTime() + (Number(overlap.durationMin) || 30) * 60_000);
            if (rangesOverlap(startAt, endAt, oStart, oEnd)) {
                return res.status(409).json({ error: "Slot already booked" });
            }
        }

        // Create Lead first (assigned to agent)
        const lead = await prisma.lead.create({
            data: {
                firstName: parsed.firstName,
                lastName: parsed.lastName,
                email: parsed.email ? String(parsed.email) : null,
                phone: parsed.phone,
                note: parsed.note ? String(parsed.note) : null,
                source: "WEBSITE",
                status: "NEW",
                listingId: listing?.id || null,
                assignedAgentId: agent.id,
                pageUrl: parsed.pageUrl || null,
                userAgent: req.get("user-agent") || null,
                ip: (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
                    .toString()
                    .slice(0, 64),
            },
        });

        // Create Appointment
        const appt = await prisma.appointment.create({
            data: {
                agentId: agent.id,
                startAt,
                durationMin,
                customerName: `${parsed.firstName} ${parsed.lastName}`.trim(),
                customerPhone: parsed.phone,
                customerEmail: parsed.email ? String(parsed.email) : null,
                note: parsed.note ? String(parsed.note) : null,
                source: "website",
                status: "CONFIRMED",
                leadId: lead.id,
            },
        });

        res.json({
            ok: true,
            leadId: lead.id,
            appointmentId: appt.id,
        });
    } catch (err) {
        console.error(err);
        if (err?.name === "ZodError") {
            return res.status(400).json({ error: err.errors?.[0]?.message || "Invalid payload" });
        }
        res.status(500).json({ error: "Failed to book" });
    }
});

module.exports = router;