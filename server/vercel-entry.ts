import { createApiApp } from './_core/app';

const app = createApiApp();
app.use((_req, res) => res.status(404).json({ error: 'API route not found' }));
export default app;
