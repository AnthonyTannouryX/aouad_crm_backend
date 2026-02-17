// src/app.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

/* =========================
   ROUTE IMPORTS
========================= */
const authRoutes = require("./routes/auth.routes");
const listingsRoutes = require("./routes/listings.routes");
const uploadsRoutes = require("./routes/uploads.routes");
const usersRoutes = require("./routes/users.routes");
const publicRoutes = require("./routes/public.routes");

// ✅ ADMIN routes
const adminClientsRoutes = require("./routes/admin.clients.routes");
const adminDevelopersRoutes = require("./routes/admin.developers.routes");
const adminCareersRoutes = require("./routes/admin.careers.routes");

// ✅ PUBLIC routes
const publicDevelopersRoutes = require("./routes/public.developers.routes");
const publicCareersRoutes = require("./routes/public.careers.routes");

// ✅ AGENT routes (NEW)
const agentRoutes = require("./routes/agent.routes");

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(helmet());

app.use(
  cors({
    origin: true, // tighten later if needed
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(morgan("dev"));

/* =========================
   HEALTH
========================= */
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

/* =========================
   STATIC FILES
========================= */
// serve uploaded files publicly (logos, listing images, CVs, etc.)
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

/* =========================
   PUBLIC (NO AUTH)
========================= */
app.use("/api/public", publicRoutes);
app.use("/api/public", publicDevelopersRoutes);
app.use("/api/public", publicCareersRoutes);

/* =========================
   AUTH
========================= */
app.use("/api/auth", authRoutes);

/* =========================
   CORE (AUTH INSIDE ROUTES)
========================= */
app.use("/api/listings", listingsRoutes);
app.use("/api/users", usersRoutes);

/* =========================
   UPLOADS (AUTH INSIDE ROUTE)
========================= */
app.use("/api/uploads", uploadsRoutes);

/* =========================
   ADMIN (ADMIN ONLY – auth + role enforced INSIDE routes)
========================= */
app.use("/api/admin", adminClientsRoutes);
app.use("/api/admin", adminDevelopersRoutes);
app.use("/api/admin", adminCareersRoutes);

/* =========================
   AGENT (AGENT ONLY – NEW)
========================= */
app.use("/api/agent", agentRoutes);

/* =========================
   ROOT
========================= */
app.get("/", (req, res) => {
  res.json({ ok: true, service: "aouad-crm-backend" });
});

module.exports = { app };
