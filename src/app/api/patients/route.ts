import { scrubx } from "@/server/scrubx";

/** Patient picker list: id, name and a one-line summary. */
export async function GET() {
  return Response.json(await scrubx().patients.list());
}
