import { scrubx } from "@/server/scrubx";

export async function GET(_req: Request, ctx: RouteContext<"/api/patients/[id]">) {
  const { id } = await ctx.params;
  const patient = await scrubx().patients.get(id);
  return patient ? Response.json(patient) : Response.json({ error: "Unknown patient" }, { status: 404 });
}
