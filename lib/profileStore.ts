import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { del, list, put } from "@vercel/blob";
import { DEFAULT_PROFILE, sanitizeProfile, type Profile } from "@/lib/profileData";

// 저장할 때마다 새 이름(무작위 접미사)으로 올려 CDN 캐시 문제를 피하고, 최근 10개를 이력으로 남긴다
const PROFILE_PREFIX = "profile/profile";
const KEEP_VERSIONS = 10;
// 틀린 시도는 빈 표식 파일로 남긴다 — 내용을 읽지 않고 목록만 세면 되므로 캐시 영향이 없다
const FAIL_PREFIX = "profile/fail-";
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

export const isProfileStoreReady = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN && process.env.PROFILE_PIN);

async function versions() {
  const { blobs } = await list({ prefix: PROFILE_PREFIX });
  return blobs.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
}

/** 가장 최근에 저장한 프로필. 저장소가 없거나 읽지 못하면 기본값 */
export async function getProfile(): Promise<Profile> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return DEFAULT_PROFILE;
  try {
    const [latest] = await versions();
    if (!latest) return DEFAULT_PROFILE;
    const res = await fetch(latest.url, { cache: "no-store" });
    if (!res.ok) return DEFAULT_PROFILE;
    return sanitizeProfile(await res.json()) ?? DEFAULT_PROFILE;
  } catch (e) {
    console.error("[profile] 읽기 실패", e);
    return DEFAULT_PROFILE;
  }
}

export async function saveProfile(profile: Profile): Promise<void> {
  await put(`${PROFILE_PREFIX}.json`, JSON.stringify(profile), {
    access: "public",
    addRandomSuffix: true,
    contentType: "application/json",
  });
  const old = (await versions()).slice(KEEP_VERSIONS).map((b) => b.url);
  if (old.length) await del(old);
}

export function pinMatches(input: string): boolean {
  const expected = process.env.PROFILE_PIN ?? "";
  if (!expected) return false;
  const a = createHash("sha256").update(input.trim()).digest();
  const b = createHash("sha256").update(expected.trim()).digest();
  return timingSafeEqual(a, b);
}

async function recentFails() {
  const { blobs } = await list({ prefix: FAIL_PREFIX });
  const since = Date.now() - LOCK_MS;
  const stale = blobs.filter((b) => b.uploadedAt.getTime() < since).map((b) => b.url);
  if (stale.length) await del(stale).catch(() => {});
  return blobs.filter((b) => b.uploadedAt.getTime() >= since);
}

/** 15분 안에 5번 틀렸으면 잠긴 남은 분(올림), 아니면 0 */
export async function lockedMinutes(): Promise<number> {
  const fails = await recentFails();
  if (fails.length < MAX_FAILS) return 0;
  const oldest = Math.min(...fails.map((b) => b.uploadedAt.getTime()));
  return Math.max(1, Math.ceil((oldest + LOCK_MS - Date.now()) / 60000));
}

/** 틀린 시도를 남기고, 잠기기까지 남은 횟수를 돌려준다 */
export async function recordFail(): Promise<number> {
  await put(`${FAIL_PREFIX}${Date.now()}.txt`, "x", { access: "public", addRandomSuffix: true, contentType: "text/plain" });
  return Math.max(0, MAX_FAILS - (await recentFails()).length);
}

export async function clearFails(): Promise<void> {
  const { blobs } = await list({ prefix: FAIL_PREFIX });
  if (blobs.length) await del(blobs.map((b) => b.url));
}
