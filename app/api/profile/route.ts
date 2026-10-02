import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { sanitizeProfile } from "@/lib/profileData";
import {
  clearFails,
  getProfile,
  isProfileStoreReady,
  lockedMinutes,
  pinMatches,
  recordFail,
  saveProfile,
} from "@/lib/profileStore";

export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

/**
 * 프로필 확인·저장. body: { pin, action: "verify" | "save", profile? }
 * 비밀번호는 서버 환경변수(PROFILE_PIN)와만 비교하고, 15분 안에 5번 틀리면 잠근다.
 */
export async function POST(req: Request) {
  if (!isProfileStoreReady()) return fail(503, "프로필 저장소가 아직 설정되지 않았어요.");

  let body: { pin?: unknown; action?: unknown; profile?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail(400, "요청 형식이 올바르지 않아요.");
  }

  const locked = await lockedMinutes();
  if (locked) return fail(429, `비밀번호를 여러 번 틀려서 잠겼어요. ${locked}분 뒤에 다시 시도해 주세요.`);

  if (typeof body.pin !== "string" || !pinMatches(body.pin)) {
    const left = await recordFail();
    await sleep(800);
    return fail(401, left ? `비밀번호가 맞지 않아요. ${left}번 더 틀리면 15분 동안 잠겨요.` : "비밀번호를 여러 번 틀려서 15분 동안 잠겼어요.");
  }
  await clearFails();

  if (body.action === "verify") return NextResponse.json({ ok: true, profile: await getProfile() });

  if (body.action === "save") {
    const current = await getProfile();
    const profile = sanitizeProfile(body.profile, current.photo);
    if (!profile) return fail(400, "이름은 비워 둘 수 없어요.");
    await saveProfile(profile);
    revalidatePath("/");
    return NextResponse.json({ ok: true, profile });
  }

  return fail(400, "알 수 없는 요청이에요.");
}
