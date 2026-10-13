import handler from '../server/vercel-handler.cjs';

// All API dependencies are bundled during the build. No extensionless TypeScript
// imports are left for the Vercel runtime to resolve.
export default handler.default;
