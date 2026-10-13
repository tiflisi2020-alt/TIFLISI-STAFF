import { createApiApp } from "../server/_core/app";

// Vercel owns the HTTP listener. Never start a persistent server in this function.
const app = createApiApp();
app.use((_req, res) => res.status(404).json({ error: "API route not found" }));
export default app;
