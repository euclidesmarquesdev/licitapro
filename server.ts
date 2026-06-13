import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import apiRouter from "./src/server/routes/api";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure CORS middleware for trusted domains (dynamic allowed origin check)
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }));

  // JSON request limit protections
  app.use(express.json({ limit: "20mb" }));

  // Security headers configuration (clickjacking and cross-site scripting guards)
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    next();
  });

  // Mount clean, modular API routes under /api
  app.use("/api", apiRouter);

  // Serve static UI assets or integrate Vite middleware in development mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[LicitaPro Server] Servidor de produção rodando no host 0.0.0.0:${PORT}`);
  });
}

startServer();
