"use client";

import { useState } from "react";
import { IconPlus, IconX } from "@tabler/icons-react";
import type { Education, Experience, Profile } from "@/lib/profileData";

interface Props {
  profile: Profile;
  busy: boolean;
  message: { tone: "error" | "ok"; text: string } | null;
  onCancel: () => void;
  onSave: (p: Profile) => void;
}

const splitWords = (v: string) =>
  v
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

/** 프로필 수정 양식 — 비밀번호 확인을 통과한 뒤에만 열린다 */
export default function ProfileEditor({ profile, busy, message, onCancel, onSave }: Props) {
  const [form, setForm] = useState(profile);
  const [certs, setCerts] = useState(profile.certs.join(", "));
  const [skills, setSkills] = useState(profile.skills.join(", "));

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setExp = (i: number, patch: Partial<Experience>) =>
    set("experience", form.experience.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const setEdu = (i: number, patch: Partial<Education>) =>
    set("education", form.education.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...form, certs: splitWords(certs), skills: splitWords(skills) });
  };

  return (
    <form className="pf-form" onSubmit={submit}>
      <h3 className="pf-title">프로필 수정</h3>

      <div className="pf-grid">
        <label>
          이름
          <input value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={40} />
        </label>
        <label>
          경력 기간
          <input value={form.career} onChange={(e) => set("career", e.target.value)} maxLength={40} placeholder="경력 5년 2개월" />
        </label>
        <label className="pf-wide">
          직무
          <input value={form.role} onChange={(e) => set("role", e.target.value)} maxLength={80} />
        </label>
        <label className="pf-wide">
          소개
          <textarea value={form.summary} onChange={(e) => set("summary", e.target.value)} rows={3} maxLength={400} />
        </label>
      </div>

      <div className="pf-section-head">
        <h4>경력</h4>
        <button
          type="button"
          className="pf-add"
          onClick={() => set("experience", [{ company: "", period: "", role: "", desc: "" }, ...form.experience])}
        >
          <IconPlus size={14} stroke={2} /> 맨 위에 추가
        </button>
      </div>
      {form.experience.map((e, i) => (
        <fieldset key={i} className="pf-row">
          <button type="button" className="pf-remove" onClick={() => set("experience", form.experience.filter((_, j) => j !== i))} aria-label={`${e.company || "이 경력"} 빼기`}>
            <IconX size={14} stroke={2} />
          </button>
          <div className="pf-grid">
            <label>
              회사
              <input value={e.company} onChange={(ev) => setExp(i, { company: ev.target.value })} maxLength={80} />
            </label>
            <label>
              기간
              <input value={e.period} onChange={(ev) => setExp(i, { period: ev.target.value })} maxLength={40} placeholder="2024.12 — 재직중" />
            </label>
            <label className="pf-wide">
              부서 · 직급
              <input value={e.role} onChange={(ev) => setExp(i, { role: ev.target.value })} maxLength={80} />
            </label>
            <label className="pf-wide">
              한 일
              <textarea value={e.desc} onChange={(ev) => setExp(i, { desc: ev.target.value })} rows={2} maxLength={400} />
            </label>
          </div>
        </fieldset>
      ))}

      <div className="pf-section-head">
        <h4>학력</h4>
        <button type="button" className="pf-add" onClick={() => set("education", [...form.education, { school: "", period: "", degree: "" }])}>
          <IconPlus size={14} stroke={2} /> 추가
        </button>
      </div>
      {form.education.map((e, i) => (
        <fieldset key={i} className="pf-row">
          <button type="button" className="pf-remove" onClick={() => set("education", form.education.filter((_, j) => j !== i))} aria-label={`${e.school || "이 학력"} 빼기`}>
            <IconX size={14} stroke={2} />
          </button>
          <div className="pf-grid">
            <label>
              학교
              <input value={e.school} onChange={(ev) => setEdu(i, { school: ev.target.value })} maxLength={80} />
            </label>
            <label>
              기간
              <input value={e.period} onChange={(ev) => setEdu(i, { period: ev.target.value })} maxLength={40} />
            </label>
            <label className="pf-wide">
              전공 · 학위
              <input value={e.degree} onChange={(ev) => setEdu(i, { degree: ev.target.value })} maxLength={80} />
            </label>
          </div>
        </fieldset>
      ))}

      <div className="pf-grid">
        <label className="pf-wide">
          자격 <small>쉼표로 구분</small>
          <textarea value={certs} onChange={(e) => setCerts(e.target.value)} rows={2} />
        </label>
        <label className="pf-wide">
          스킬 <small>쉼표로 구분 · 앞의 10개가 홈 카드에 보여요</small>
          <textarea value={skills} onChange={(e) => setSkills(e.target.value)} rows={2} />
        </label>
      </div>

      <div className="pf-foot pf-sticky">
        {message && <p className={`pf-msg is-${message.tone}`}>{message.text}</p>}
        <button type="button" className="nx-btn nx-btn-ghost" onClick={onCancel} disabled={busy}>
          취소
        </button>
        <button type="submit" className="nx-btn" disabled={busy}>
          {busy ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}
