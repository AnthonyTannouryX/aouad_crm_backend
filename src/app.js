// src/app.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const authRoutes = require("./routes/auth.routes");
const listingsRoutes = require("./routes/listings.routes");
const uploadsRoutes = require("./routes/uploads.routes");
const usersRoutes = require("./routes/users.routes");
const publicRoutes = require("./routes/public.routes");

// ADMIN routes
const adminClientsRoutes = require("./routes/admin.clients.routes");
const adminDevelopersRoutes = require("./routes/admin.developers.routes");
const adminCareersRoutes = require("./routes/admin.careers.routes");
const adminClientStoriesRoutes = require("./routes/admin.clientStories.routes");

// PUBLIC routes
const publicDevelopersRoutes = require("./routes/public.developers.routes");
const publicCareersRoutes = require("./routes/public.careers.routes");
const publicClientStoriesRoutes = require("./routes/public.clientStories.routes");

// AGENT routes
const agentRoutes = require("./routes/agent.routes");

const app = express();

app.use(helmet());
app.use(
   cors({
      origin: true,
      credentials: true,
   })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan("dev"));

// HEALTH
app.get("/api/health", (req, res) => res.json({ ok: true }));

// STATIC
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

/* =========================
   PUBLIC (NO AUTH)
   IMPORTANT: mount client-stories BEFORE publicRoutes
========================= */
app.use("/api/public", publicClientStoriesRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/public", publicDevelopersRoutes);
app.use("/api/public", publicCareersRoutes);

// AUTH
app.use("/api/auth", authRoutes);

// CORE
app.use("/api/listings", listingsRoutes);
app.use("/api/users", usersRoutes);

// UPLOADS
app.use("/api/uploads", uploadsRoutes);

// ADMIN
app.use("/api/admin", adminClientsRoutes);
app.use("/api/admin", adminDevelopersRoutes);
app.use("/api/admin", adminCareersRoutes);
app.use("/api/admin", adminClientStoriesRoutes);

// AGENT
app.use("/api/agent", agentRoutes);

// ROOT
app.get("/", (req, res) => {
   res.json({ ok: true, service: "aouad-crm-backend" });
});

module.exports = { app };
