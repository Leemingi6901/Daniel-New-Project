"use client";

import { useEffect, useState } from "react";

const RESUME = {
  name: "이민기",
  role: "인프라 엔지니어 · 정보보안 전문가",
  summary:
    "경력 5년 2개월 · AI/GPU 인프라부터 네트워크 보안까지, IT 라이프사이클 전반을 다뤄온 인프라 엔지니어입니다.",
  photo: "/profile.jpg",
  experience: [
    {
      company: "오륜디지탈 (하나금융융합기술원 파견)",
      period: "2024.12 — 재직중",
      role: "SE · 대리",
      desc: "H100/A100 GPU 140장 클러스터 운영, CentOS → Rocky Linux 마이그레이션(130대), Grafana/Zabbix 통합 모니터링",
    },
    {
      company: "하이랜드푸드",
      period: "2023.06 — 2024.12",
      role: "네트워크·운영개발팀 · 선임",
      desc: "Zabbix·Grafana 자체 모니터링 환경 구축, DLP 도입, 전국 3개 거점 방화벽 정책 통합 관리",
    },
    {
      company: "바이오플러스",
      period: "2022.08 — 2023.06",
      role: "경영지원팀 · 주임",
      desc: "신규 사옥 서버실 구축(Rack/UPS/Cabling), 본사-지사 VPN 터널링, NextCloud 프라이빗 클라우드 도입",
    },
    {
      company: "블록체인컴퍼니",
      period: "2022.04 — 2022.07",
      role: "정보보안팀 · 사원",
      desc: "가상자산 거래소 ISMS 인증 심사 대응, 접근통제 정책 재설계, 취약점 점검 및 조치",
    },
    {
      company: "에코넷시스템",
      period: "2021.08 — 2022.04",
      role: "보안영업본부 · 사원",
      desc: "국방·공공기관 대상 SI 제안(RFP) 작성 및 입찰, 서버·보안 장비 구축 지원",
    },
  ],
  education: [
    {
      school: "영진전문대학 (2·3년제)",
      period: "2016.02 — 2022.02",
      degree: "컴퓨터정보계열 네트워크보안 · 전문학사",
    },
    {
      school: "학점은행제",
      period: "2022.12 — 2023.10",
      degree: "컴퓨터정보공학 · 학사",
    },
  ],
  certs: ["리눅스마스터 2급", "네트워크관리사 2급", "1종보통운전면허"],
  skills: [
    "Linux",
    "OpenStack",
    "Docker",
    "NVIDIA GPU",
    "Zabbix",
    "Grafana",
    "Firewall",
    "VPN",
    "ISMS",
    "취약점진단",
    "DLP",
  ],
};

export default function ProfileCard() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div className="nx-avatar-group">
        <button
          type="button"
          className="nx-avatar-btn"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`${RESUME.name} 프로필 보기`}
        >
          <span className="nx-avatar-photo-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={RESUME.photo} alt={RESUME.name} />
          </span>
        </button>
        <span className="nx-avatar-hint" aria-hidden="true">
          프로필 보러가기
          <em>Click →</em>
        </span>
      </div>

      <div
        className={`nx-modal-backdrop ${open ? "is-open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      >
        <div className="nx-modal" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="nx-modal-close" onClick={() => setOpen(false)} aria-label="닫기">
            ✕
          </button>

          <div className="nx-modal-head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="nx-modal-photo" src={RESUME.photo} alt={RESUME.name} />
            <div>
              <strong>{RESUME.name}</strong>
              <em>{RESUME.role}</em>
            </div>
          </div>

          <p className="nx-profile-summary">{RESUME.summary}</p>

          <h4>경력</h4>
          <ul className="nx-profile-timeline">
            {RESUME.experience.map((e) => (
              <li key={e.company}>
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
            {RESUME.education.map((e) => (
              <li key={e.school}>
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
            {RESUME.certs.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>

          <h4>스킬</h4>
          <div className="nx-profile-chips nx-profile-chips-skill">
            {RESUME.skills.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
