import { useState, useEffect } from "react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  LayoutDashboard,
  Target,
  Sparkles,
  ChartNoAxesCombined,
  Settings,
  Search,
  Plus,
  ArrowUpRight,
  LogOut,
  WifiOff,
  RefreshCw,
  Download,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../app/providers/AuthProvider";
import { useData } from "../app/providers/DataProvider";
import { useToast, ErrorNotice } from "../app/providers/UIProvider";
import { initials } from "../lib/utils";
import { errorMessage } from "../lib/api";
import { AddWord } from "./vocabulary/AddWord";
import { Modal } from "./ui";
const nav = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/vocabulary", label: "My vocabulary", icon: BookOpen },
  { to: "/review", label: "Daily review", icon: Target },
  { to: "/search", label: "Find a word", icon: Search },
  { to: "/tutor", label: "AI tutor", icon: Sparkles },
  { to: "/progress", label: "My progress", icon: ChartNoAxesCombined },
];
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function Layout() {
  const { user, signOut } = useAuth();
  const { data, error, online, cached, pending, refresh } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const [add, setAdd] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const name =
    data.profile?.display_name ||
    user?.user_metadata.display_name ||
    "Word explorer";
  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  async function logout() {
    try {
      await signOut();
      navigate("/login");
    } catch (e) {
      toast(errorMessage(e));
    }
  }
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <Link to="/dashboard" className="logo">
            Lexi
            <span />
          </Link>
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          >
            <X />
          </button>
        </div>
        <div className="sidebar-caption">A LITTLE MORE ARTICULATE.</div>
        <nav aria-label="Main navigation">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              to={to}
              key={to}
              onClick={() => setMenu(false)}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={20} />
              <span>{label}</span>
              {to === "/tutor" && <span className="ai-pill">AI</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="tiny-star">✦</div>
          <h3>
            Little words.
            <br />
            Bigger worlds.
          </h3>
          <p>
            A few minutes today.
            <br />A word you’ll keep forever.
          </p>
          <Link to="/quiz" onClick={() => setMenu(false)}>
            Try a quick practice <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="sidebar-bottom">
          <NavLink
            to="/settings"
            className="nav-item"
            onClick={() => setMenu(false)}
          >
            <Settings size={20} />
            Settings
          </NavLink>
          {install && (
            <button
              className="nav-item"
              onClick={async () => {
                await install.prompt();
                setInstall(null);
              }}
            >
              <Download size={20} />
              Install Lexi
            </button>
          )}
          <button
            className="nav-item"
            onClick={() =>
              pending > 0 ? setLogoutConfirm(true) : void logout()
            }
          >
            <LogOut size={20} />
            Sign out
          </button>
        </div>
        <div className="sidebar-user">
          <span className="avatar">{initials(name)}</span>
          <div>
            <strong>{name}</strong>
            <small>Your learning space</small>
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <button
              className="icon-button"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
            <Link to="/dashboard" className="logo">
              Lexi
              <span />
            </Link>
          </div>
          <form
            className="global-search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/vocabulary?q=${encodeURIComponent(search)}`);
              setSearch("");
            }}
          >
            <Search size={18} />
            <input
              aria-label="Search your vocabulary"
              placeholder="A word on your mind?"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>↵</kbd>
          </form>
          <div className="topbar-actions">
            <span className="date-label">
              {new Date().toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <button
              className="button primary small"
              onClick={() => setAdd(true)}
            >
              <Plus size={18} />
              <span>Add a word</span>
            </button>
            <Link className="avatar" to="/settings" aria-label="Your profile">
              {initials(name)}
            </Link>
          </div>
        </header>
        {!online && (
          <div className="connection-banner">
            <WifiOff size={16} />
            You’re offline. Your saved words are here.
            {pending > 0 && ` ${pending} reviews will sync when you reconnect.`}
          </div>
        )}
        {cached && online && (
          <div className="connection-banner">
            Showing your last saved copy.{" "}
            <button onClick={() => void refresh()}>
              Reconnect <RefreshCw size={14} />
            </button>
          </div>
        )}
        <main id="main-content">
          <ErrorNotice message={error} />
          <Outlet context={{ openAdd: () => setAdd(true) }} />
        </main>
        <footer className="app-footer">
          <span>Made for the words you don’t want to forget.</span>
          <span>
            One word at a time <span className="coral-dot">✦</span>
          </span>
        </footer>
      </div>
      <nav className="mobile-bottom" aria-label="Mobile navigation">
        {[
          nav[0],
          nav[1],
          nav[2],
          nav[4],
          { to: "/settings", label: "More", icon: Settings },
        ].map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to}>
            <Icon size={21} />
            <span>
              {label === "Overview"
                ? "Home"
                : label === "My vocabulary"
                  ? "Words"
                  : label === "Daily review"
                    ? "Review"
                    : label === "AI tutor"
                      ? "Tutor"
                      : label}
            </span>
          </NavLink>
        ))}
      </nav>
      <AddWord open={add} onClose={() => setAdd(false)} />
      <Modal
        open={logoutConfirm}
        onClose={() => setLogoutConfirm(false)}
        title="A few reviews are still on this device."
      >
        <p>
          {pending} reviews haven’t synced yet. Connect and refresh to save them
          to your account. Signing out removes this device’s saved copy and
          unsynced attempts.
        </p>
        <div className="modal-actions">
          <button
            className="button secondary"
            onClick={() => setLogoutConfirm(false)}
          >
            Stay and sync later
          </button>
          <button
            className="button primary"
            onClick={() => {
              setLogoutConfirm(false);
              void logout();
            }}
          >
            Sign out anyway
          </button>
        </div>
      </Modal>
    </div>
  );
}
