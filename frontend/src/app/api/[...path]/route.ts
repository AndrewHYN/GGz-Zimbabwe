import { handle } from "@/lib/server/handler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
