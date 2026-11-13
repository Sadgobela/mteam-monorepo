import type { NextRequest } from "next/server";
import { startSocialLogin } from "@/lib/social-login";

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  return startSocialLogin(request, (await params).provider);
}
