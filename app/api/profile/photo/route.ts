import { NextResponse } from "next/server";
import { clearFails, isProfileStoreReady, lockedMinutes, pinMatches, recordFail, savePhoto } from "@/lib/profileStore";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

/** 프로필 사진 올리기. FormData { pin, file } — 비밀번호 확인과 잠금은 /api/profile과 같다 */
export async function POST(req: Request) {
  if (!isProfileStoreReady()) return fail(503, "프로필 저장소가 아직 설정되지 않았어요.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "요청 형식이 올바르지 않아요.");
  }

  const locked = await lockedMinutes();
  if (locked) return fail(429, `비밀번호를 여러 번 틀려서 잠겼어요. ${locked}분 뒤에 다시 시도해 주세요.`);

  const pin = form.get("pin");
  if (typeof pin !== "string" || !pinMatches(pin)) {
    const left = await recordFail();
    await sleep(800);
    return fail(401, left ? `비밀번호가 맞지 않아요. ${left}번 더 틀리면 15분 동안 잠겨요.` : "비밀번호를 여러 번 틀려서 15분 동안 잠겼어요.");
  }
  await clearFails();

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) return fail(400, "사진 파일이 없어요.");
  if (file.type !== "image/jpeg") return fail(400, "JPEG 사진만 올릴 수 있어요.");
  if (file.size > MAX_BYTES) return fail(400, "사진이 너무 커요. 2MB 이하로 올려 주세요.");

  return NextResponse.json({ ok: true, url: await savePhoto(file) });
}
