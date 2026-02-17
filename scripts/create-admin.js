// scripts/create-admin.js
const bcrypt = require("bcryptjs");
const { prisma } = require("../src/lib/prisma");

async function main() {
    const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
    const password = process.env.ADMIN_PASSWORD || "";
    const fullName = process.env.ADMIN_NAME || "Admin";

    if (!email || !password) {
        throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD");
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: { email },
        update: { fullName, passwordHash: hash, role: "ADMIN", isActive: true },
        create: { fullName, email, passwordHash: hash, role: "ADMIN", isActive: true },
        select: { id: true, email: true, role: true },
    });

    console.log("✅ Admin ready:", user);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
