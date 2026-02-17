const router = require("express").Router();
const { auth, requireRole } = require("../middlewares/auth");
const { prisma } = require("../lib/prisma");

// 🔒 ADMIN ONLY
router.use(auth, requireRole("ADMIN"));

router.get("/dashboard", async (req, res) => {
    const totalListings = await prisma.listing.count();
    const totalClients = await prisma.client.count();
    const totalAgents = await prisma.user.count({
        where: { role: "AGENT" },
    });

    res.json({
        totalListings,
        totalClients,
        totalAgents,
    });
});

module.exports = router;
