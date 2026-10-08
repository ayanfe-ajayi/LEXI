import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Sparkles,
  Target,
  Eye,
  EyeOff,
  Loader2,
  Check,
} from "lucide-react";
import { useAuth } from "../app/providers/AuthProvider";
import { ErrorNotice } from "../app/providers/UIProvider";
import { configured, supabase } from "../lib/supabase";
import { errorMessage } from "../lib/api";
export function Login({
  welcome = false,
  reset = false,
}: {
  welcome?: boolean;
  reset?: boolean;
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [signup, setSignup] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  if (user && !reset && !loading) return <Navigate to="/dashboard" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!configured)
        throw new Error(
          "Add the Supabase project URL and publishable key to .env.local first.",
        );
      if (reset) {
        if (!user)
          throw new Error(
            "Open the password recovery link from your email first.",
          );
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        navigate("/dashboard");
      } else if (forgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage(
          "If an account exists for this email, a recovery link will be sent.",
        );
      } else if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: `${location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        if (data.session) navigate("/dashboard");
        else
          setMessage(
            "Check your email to confirm your account, then come back to sign in.",
          );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate("/dashboard");
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const title = reset
    ? "A fresh start."
    : forgot
      ? "Find your way back."
      : signup
        ? "Your next word awaits."
        : "Welcome back.";
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Link className="logo light" to="/">
          Lexi
          <span />
        </Link>
        <div className="auth-story-content">
          <p className="eyebrow">KEEP THE WORDS. GROW YOUR WORLD.</p>
          <h1>
            A little more
            <br />
            <em>articulate.</em>
          </h1>
          <p className="auth-intro">
            That word from a movie. That line in a book.
            <br />
            Make it part of your everyday vocabulary.
          </p>
          <div className="word-illustration">
            <div className="floating-note note-one">✦ A word worth keeping</div>
            <div className="illustration-card">
              <div className="eyebrow">ADJECTIVE · A MOMENT OF DISCOVERY</div>
              <div className="illustration-word">
                serendipitous <span>✦</span>
              </div>
              <span className="ipa">/ˌser.ənˈdɪp.ɪ.təs/</span>
              <p>
                Finding something beautiful
                <br />
                when you weren’t looking for it.
              </p>
              <div className="illustration-example">
                “A serendipitous encounter.”
              </div>
              <div className="illustration-bottom">
                <span>
                  <Check size={15} /> A word you’ll remember
                </span>
                <BookOpen size={20} />
              </div>
            </div>
            <div className="floating-note note-two">
              One word. A whole new possibility.
            </div>
            <div className="illustration-orbit orbit-one" />
            <div className="illustration-orbit orbit-two" />
          </div>
          <div className="auth-benefits">
            <div>
              <BookOpen size={21} />
              <span>Collect your discoveries</span>
            </div>
            <div>
              <Target size={21} />
              <span>Remember with practice</span>
            </div>
            <div>
              <Sparkles size={21} />
              <span>Learn with your AI tutor</span>
            </div>
          </div>
          <p className="story-footer">
            Small discoveries. Lasting understanding.
          </p>
        </div>
      </section>
      <section className="auth-form-side" id="main-content">
        <div className="auth-top-note">
          YOUR PERSONAL VOCABULARY COMPANION <span>✦</span>
        </div>
        {welcome && !reset ? (
          <div className="welcome-content">
            <span className="welcome-sparkle">✦</span>
            <p className="eyebrow">HELLO, WORD EXPLORER</p>
            <h2>
              Discover it.
              <br />
              Save it.
              <br />
              <span>Make it yours.</span>
            </h2>
            <p>
              Your vocabulary deserves more than a forgotten note. Lexi helps
              you understand, practise, and remember the words you find along
              the way.
            </p>
            <Link to="/login" className="button primary wide">
              Start your next chapter <ArrowRight size={19} />
            </Link>
            <p className="auth-switch">
              Already have a space here? <Link to="/login">Sign in</Link>
            </p>
            <div className="welcome-foot">
              <span className="dot purple" />A little practice goes a long way.
            </div>
          </div>
        ) : (
          <div className="auth-form-wrap">
            <p className="eyebrow">
              {reset
                ? "PASSWORD RECOVERY"
                : signup
                  ? "A NEW CHAPTER"
                  : "YOUR WORDS ARE WAITING"}
            </p>
            <h2>{title}</h2>
            <p className="subtitle">
              {reset
                ? "Choose a new password for your account."
                : forgot
                  ? "We’ll send you a link to reset your password."
                  : signup
                    ? "Make a little space for your next discovery."
                    : "Let’s pick up where you left off."}
            </p>
            <ErrorNotice message={error} />
            {message && (
              <div className="success-notice" role="status">
                <Check size={18} />
                {message}
              </div>
            )}
            <form onSubmit={submit}>
              {signup && !forgot && (
                <label>
                  Your name
                  <input
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                    required
                    placeholder="What should we call you?"
                  />
                </label>
              )}
              {!reset && (
                <label>
                  Email address
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                  />
                </label>
              )}
              {!forgot && (
                <label>
                  Password
                  <div className="password-field">
                    <input
                      type={visible ? "text" : "password"}
                      autoComplete={
                        signup || reset ? "new-password" : "current-password"
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={signup || reset ? 8 : 1}
                      required
                      placeholder={
                        signup || reset
                          ? "At least 8 characters"
                          : "Your password"
                      }
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={visible ? "Hide password" : "Show password"}
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
              )}
              {!signup && !forgot && !reset && (
                <button
                  type="button"
                  className="forgot-link"
                  onClick={() => {
                    setForgot(true);
                    setError("");
                    setMessage("");
                  }}
                >
                  Forgot password?
                </button>
              )}
              <button className="button primary wide" disabled={busy}>
                {busy ? (
                  <Loader2 className="spin" size={19} />
                ) : (
                  <>
                    {reset
                      ? "Update password"
                      : forgot
                        ? "Send recovery link"
                        : signup
                          ? "Create my account"
                          : "Back to my words"}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
            {!reset && (
              <p className="auth-switch">
                {forgot ? (
                  <button
                    onClick={() => {
                      setForgot(false);
                      setMessage("");
                      setError("");
                    }}
                  >
                    Back to sign in
                  </button>
                ) : (
                  <>
                    {signup ? "Already have an account?" : "New to Lexi?"}{" "}
                    <button
                      onClick={() => {
                        setSignup(!signup);
                        setError("");
                        setMessage("");
                      }}
                    >
                      {signup ? "Sign in" : "Create an account"}
                    </button>
                  </>
                )}
              </p>
            )}
            <div className="welcome-foot">
              <span className="dot purple" />
              Your words, in your own private learning space.
            </div>
          </div>
        )}
        <span className="auth-bottom-note">
          LEARN A LITTLE. REMEMBER A LOT.
        </span>
      </section>
    </div>
  );
}
