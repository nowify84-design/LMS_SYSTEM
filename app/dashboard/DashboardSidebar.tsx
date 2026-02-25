"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const iconClass = "w-6 h-6";
const stroke = "currentColor";


function HomeIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

const links = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/dashboard/student", label: "Student information", icon: UserIcon },
  { href: "/dashboard/tasks", label: "Task board", icon: DocumentIcon },
];

export default function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="w-16 flex-shrink-0 flex flex-col items-center py-4 bg-[#e8ece9] rounded-r-2xl shadow-sm"
      style={{ minHeight: "calc(100vh - 2rem)" }}
      aria-label="Main navigation"
    >
      <Link
        href="/dashboard"
        className="flex items-center justify-center w-10 h-10 rounded-full bg-white overflow-hidden mb-6 focus:outline-none focus:ring-2 focus:ring-nowify-primary focus:ring-offset-2 focus:ring-offset-[#e8ece9]"
        title="Nowify"
      >
        <img src="/images/logo_nowify.png" alt="Nowify" className="w-8 h-8 object-contain" />
      </Link>

      <nav className="flex flex-col items-center gap-1 flex-grow">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-nowify-primary focus:ring-offset-2 focus:ring-offset-[#e8ece9] ${
                isActive ? "bg-white text-nowify-primary shadow-sm" : "text-nowify-neutral hover:bg-white/60 hover:text-nowify-text"
              }`}
              title={label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon />
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col items-center gap-1 pt-4 border-t border-nowify-border/80">
        <Link
          href="/lms"
          className="flex items-center justify-center w-10 h-10 rounded-full text-nowify-neutral hover:bg-white/60 hover:text-nowify-text transition-colors focus:outline-none focus:ring-2 focus:ring-nowify-primary focus:ring-offset-2 focus:ring-offset-[#e8ece9]"
          title="LMS Home"
        >
          <BackIcon />
        </Link>
        <Link
          href="/logout"
          className="flex items-center justify-center w-10 h-10 rounded-full text-nowify-neutral hover:bg-white/60 hover:text-nowify-text transition-colors focus:outline-none focus:ring-2 focus:ring-nowify-primary focus:ring-offset-2 focus:ring-offset-[#e8ece9]"
          title="Logout"
        >
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </Link>
      </div>
    </aside>
  );
}
