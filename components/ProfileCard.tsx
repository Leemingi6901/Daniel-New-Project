"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconBuilding } from "@tabler/icons-react";
import Modal from "@/components/Modal";
import ProfileEditor from "@/components/ProfileEditor";
import type { Profile } from "@/lib/profileData";

type View = "view" | "pin" | "edit";

/** 사진을 가운데 기준 정사각형 480px JPEG으로 줄인다(위치 정보 같은 EXIF도 함께 빠진다) */
async function toSquareJpeg(file: File, size = 480): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.88)
  );
}

export default function ProfileCard({ profile: initial }: { profile: Profile }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("view");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);

  const close = () => {
    setOpen(false);
    setView("view");
    setPin("");
    setMessage(null);
  };

  const call = async (body: object) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({ ok: false, error: "응답을 읽지 못했어요." }));
      if (!data.ok) setMessage({ tone: "error", text: data.error ?? "처리하지 못했어요." });
      return data.ok ? (data.profile as Profile) : null;
    } catch {
      setMessage({ tone: "error", text: "네트워크 오류로 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요." });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const latest = await call({ action: "verify", pin });
    if (latest) {
      setProfile(latest);
      setView("edit");
    }
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith("image/")) {
      setMessage({ tone: "error", text: "이미지 파일만 올릴 수 있어요." });
      return null;
    }
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("pin", pin);
      form.append("file", await toSquareJpeg(file), "photo.jpg");
      const res = await fetch("/api/profile/photo", { method: "POST", body: form });
      const data = await res.json().catch(() => ({ ok: false, error: "응답을 읽지 못했어요." }));
      if (!data.ok) {
        setMessage({ tone: "error", text: data.error ?? "사진을 올리지 못했어요." });
        return null;
      }
      setMessage({ tone: "ok", text: "사진을 올렸어요. 저장을 눌러야 프로필에 반영돼요." });
      return data.url as string;
    } catch {
      setMessage({ tone: "error", text: "사진을 읽거나 올리지 못했어요. 다른 사진으로 시도해 주세요." });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const save = async (next: Profile) => {
    const saved = await call({ action: "save", pin, profile: next });
    if (saved) {
      setProfile(saved);
      setView("view");
      setPin("");
      setMessage({ tone: "ok", text: "프로필을 저장했어요." });
      router.refresh();
    }
  };

  return (
    <>
      <div className="hm-profile">
        <div className="hm-profile-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hm-profile-photo" src={profile.photo} alt={profile.name} />
          <div>
            <strong>{profile.name}</strong>
            <span>{profile.role}</span>
          </div>
        </div>
        {profile.experience[0] && (
          <p className="hm-profile-company">
            <IconBuilding size={15} stroke={1.8} />
            {profile.experience[0].company}
          </p>
        )}
        <p className="hm-profile-now">
          <b>{profile.career}</b>
          {profile.experience[0] && ` · ${profile.experience[0].role}`}
        </p>
        <div className="hm-stack">
          {profile.skills.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
        <button type="button" className="nx-btn nx-btn-ghost hm-profile-btn" onClick={() => setOpen(true)} aria-expanded={open}>
          프로필 보기
        </button>
      </div>

      <Modal open={open} onClose={close}>
        {view === "edit" ? (
          <ProfileEditor
            profile={profile}
            busy={busy}
            message={message}
            onCancel={() => {
              setView("view");
              setMessage(null);
            }}
            onSave={save}
            onUploadPhoto={uploadPhoto}
          />
        ) : (
          <>
            <div className="nx-modal-head">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="nx-modal-photo" src={profile.photo} alt={profile.name} />
              <div>
                <strong>{profile.name}</strong>
                <em>{profile.role}</em>
              </div>
            </div>

            <p className="nx-profile-summary">{profile.summary}</p>

            <h4>경력</h4>
            <ul className="nx-profile-timeline">
              {profile.experience.map((e, i) => (
                <li key={`${e.company}-${i}`}>
                  <div className="nx-profile-timeline-head">
                    <strong>{e.company}</strong>
                    <span>{e.period}</span>
                  </div>
                  <p className="nx-profile-timeline-role">{e.role}</p>
                  <p>{e.desc}</p>
                </li>
              ))}
            </ul>

            <h4>학력</h4>
            <ul className="nx-profile-timeline">
              {profile.education.map((e, i) => (
                <li key={`${e.school}-${i}`}>
                  <div className="nx-profile-timeline-head">
                    <strong>{e.school}</strong>
                    <span>{e.period}</span>
                  </div>
                  <p className="nx-profile-timeline-role">{e.degree}</p>
                </li>
              ))}
            </ul>

            <h4>자격</h4>
            <div className="nx-profile-chips">
              {profile.certs.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>

            <h4>스킬</h4>
            <div className="nx-profile-chips nx-profile-chips-skill">
              {profile.skills.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>

            <div className="pf-foot">
              {message && <p className={`pf-msg is-${message.tone}`}>{message.text}</p>}
              {view === "pin" ? (
                <form className="pf-pin" onSubmit={verify}>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="비밀번호"
                    aria-label="프로필 수정 비밀번호"
                    autoFocus
                  />
                  <button type="submit" className="nx-btn" disabled={busy || !pin}>
                    {busy ? "확인 중…" : "확인"}
                  </button>
                  <button
                    type="button"
                    className="nx-btn nx-btn-ghost"
                    onClick={() => {
                      setView("view");
                      setPin("");
                      setMessage(null);
                    }}
                  >
                    취소
                  </button>
                </form>
              ) : (
                <button type="button" className="nx-btn nx-btn-ghost" onClick={() => setView("pin")}>
                  프로필 수정
                </button>
              )}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
