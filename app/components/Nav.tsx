"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "통합 요약" },
  { href: "/website", label: "홈페이지" },
  { href: "/instagram", label: "인스타그램" },
  { href: "/kakao", label: "카카오톡" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      <div className="nav-title">비마이비<br />콘텐츠 성과 대시보드</div>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={path === l.href ? "active" : ""}>
          {l.label}
        </Link>
      ))}
      <div className="nav-foot">화면마다 노란색(샘플)·초록색(실제) 안내를 확인하세요.</div>
    </nav>
  );
}
