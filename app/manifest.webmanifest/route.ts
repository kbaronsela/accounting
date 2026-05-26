import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getWebAppManifestPublicBase } from "@/lib/env/public-origin-for-manifest";
import { buildWebAppManifest } from "@/lib/pwa/build-web-app-manifest";

export const dynamic = "force-dynamic";

export async function GET() {
  const h = await headers();
  const base = getWebAppManifestPublicBase(h);
  const manifest = buildWebAppManifest(base);

  return NextResponse.json(manifest, {
    status: 200,
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
    },
  });
}
