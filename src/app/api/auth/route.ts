import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const { passcode } = await request.json();

  if (!passcode || passcode !== process.env.AUTH_TOKEN) {
    return Response.json({ error: "Incorrect passcode" }, { status: 401 });
  }

  const response = Response.json({ ok: true });
  // httpOnly so JS can't read it; secure in prod; 30-day expiry
  const maxAge = 60 * 60 * 24 * 30;
  response.headers.set(
    "Set-Cookie",
    `dripson-auth=${process.env.AUTH_TOKEN}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
  );
  return response;
}
