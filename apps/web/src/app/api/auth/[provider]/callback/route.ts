import type { NextRequest } from "next/server";
import { finishSocialLogin } from "@/lib/social-login";

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  return finishSocialLogin(request, (await params).provider);
}
