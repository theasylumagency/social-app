import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "შესვლა — UNDA", referrer: "no-referrer", robots: { index: false, follow: false } }

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-shell">
      <aside className="auth-story">
        <Link href="/login" className="brand-mark"><span className="brand-symbol" aria-hidden="true">U</span><span>UNDA</span></Link>
        <div className="auth-story-copy">
          <span className="eyebrow">შენი ბრენდის ყოველდღიური პარტნიორი</span>
          <h1>მეტი დრო<br />შენი ბიზნესისთვის.</h1>
          <p>სოციალური ოპერატორი გაიცნობს შენს ბრენდს და დაგეხმარება კონტენტის დაგეგმვაში, მომზადებასა და გამოქვეყნებაში.</p>
          <div className="auth-trial-note"><span aria-hidden="true">14</span><div><strong>დღე გამოსაცდელად</strong><p>ერთი ბრენდი · ბარათის გარეშე<br />გამოსახულების გენერაცია ფასიან ტარიფზეა.</p></div></div>
        </div>
        <p className="auth-story-footer">შენი ბიზნესი. შენი ხმა. შენი UNDA.</p>
      </aside>
      <section className="auth-content" aria-label="ანგარიშზე წვდომა">{children}</section>
    </main>
  )
}
