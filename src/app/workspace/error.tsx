"use client"

import Link from "next/link"

export default function WorkspaceError({ reset }: { reset: () => void }) {
  return <main className="account-shell"><span className="eyebrow">UNDA Social</span><h1>სამუშაო სივრცე ვერ ჩაიტვირთა</h1><p>მონაცემების მიღება დროებით ვერ მოხერხდა. სცადეთ ხელახლა.</p><div className="account-card account-section"><button className="auth-primary" onClick={reset}>ხელახლა ცდა</button><Link href="/account">ჩემი ანგარიში</Link></div></main>
}
