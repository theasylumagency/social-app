import { digest } from "./corpus"
import type { Arm, CaseReceipt, FrozenCorpus } from "./model"
import { DIAGNOSTIC_CASES } from "./runner"

const escape = (text: string) => text.replace(/[&<>"']/gu, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!))
export function blindReview(corpus: FrozenCorpus, receipts: CaseReceipt[], caseIds: readonly string[] = DIAGNOSTIC_CASES) {
  const receiptsHash = digest(receipts)
  const mock = receipts.length === 0 || receipts.every(row => row.mode === "mock-contract")
  const mode = mock ? "mock-contract" : "live-provider"
  const mapping = caseIds.map(caseId => {
    const flip = parseInt(digest([receiptsHash, caseId]).slice(0, 2), 16) % 2
    return { caseId, A: (flip ? "lowInterpreter" : "baseline") as Arm, B: (flip ? "baseline" : "lowInterpreter") as Arm }
  })
  const panels = mapping.map(pair => {
    const item = corpus.cases.find(value => value.id === pair.caseId)!, planning = item.context.planning
    const before = planning.posts?.payload.copies[item.input.context.postKey ?? ""] ?? null
    const voice = planning.run?.payload.basis.payload.understanding?.voice
    const output = (label: "A" | "B") => {
      const row = receipts.find(value => value.caseId === pair.caseId && value.arm === pair[label])
      const result = row?.result
      const presentation = result ? { response: result.interpretation.response, clarification: result.interpretation.clarification,
        statements: result.interpretation.statements, proposedWeeklyDirectives: result.interpretation.weeklyDirectives ?? null,
        decision: result.decision, status: result.status,
        selectedPostAfter: result.revisedPosts?.copies[item.input.context.postKey ?? ""] ?? null } : { result: "შედეგი ხელმისაწვდომი არ არის" }
      const scores = ["meaning", "language", "voice", "facts", "usefulness"].map(dimension => `<label>${({ meaning: "მოთხოვნის მნიშვნელობა", language: "ენა", voice: "ბრენდის ხმა", facts: "ფაქტები", usefulness: "გამოსადეგობა" }[dimension])}<select name="${pair.caseId}.${label}.${dimension}" required><option value="">აირჩიეთ 1–5</option>${[1, 2, 3, 4, 5].map(score => `<option>${score}</option>`).join("")}</select></label>`).join("")
      const flags = ["criticalError", "meaningLost", "falseBlocker"].map(flag => `<label>${({ criticalError: "კრიტიკული შეცდომა", meaningLost: "მნიშვნელობის დაკარგვა", falseBlocker: "უსაფუძვლო დაბლოკვა" }[flag])}<select name="${pair.caseId}.${label}.${flag}" required><option value="">აირჩიეთ</option><option value="false">არა</option><option value="true">დიახ</option></select></label>`).join("")
      return `<article><h3>ვერსია ${label}</h3><pre>${escape(JSON.stringify(presentation, null, 2))}</pre>${scores}${flags}<label>შენიშვნა<textarea name="${pair.caseId}.${label}.notes"></textarea></label></article>`
    }
    const context = { message: item.input.text, selectedChannel: item.input.context.channel, before, screenData: item.context.screenData,
      weeklyPostsBefore: planning.posts?.payload.copies, weeklyOutline: planning.posts?.payload.outline,
      objective: planning.run?.payload.objective, brief: planning.posts?.payload.outline?.posts[0]?.brief,
      voice, registeredPublicKnowledge: planning.run?.payload.publicKnowledge ?? null }
    return `<section><h2>${escape(pair.caseId)}</h2><details open><summary>მოთხოვნა და უცვლელი საწყისი კონტექსტი</summary><pre>${escape(JSON.stringify(context, null, 2))}</pre></details><div class="pair">${output("A")}${output("B")}</div></section>`
  }).join("")
  const binding = JSON.stringify({ version: 1, corpusHash: corpus.corpusHash, receiptsHash, mode, caseIds }).replaceAll("<", "\\u003c")
  return { mapping: { corpusHash: corpus.corpusHash, receiptsHash, pairs: mapping }, html: `<!doctype html><html lang="ka"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'"><title>T12.2 — ტექსტების ბრმა შეფასება</title><style>body{font:16px system-ui;line-height:1.5;margin:24px;background:#f5f6f8;color:#182030}main{max-width:1400px;margin:auto}section,header{background:white;padding:24px;margin-bottom:24px;border-radius:12px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px system-ui;background:#f5f6f8;padding:16px}label{display:block;margin:12px 0}select,textarea,input,button{font:inherit;padding:8px;margin-left:12px}textarea{display:block;width:90%;margin:8px 0}button{background:#164dba;color:white;border:0;border-radius:6px}@media(max-width:800px){.pair{grid-template-columns:1fr}body{margin:8px}section{padding:12px}}</style><main><header><h1>T12.2 — ტექსტების ბრმა შეფასება</h1>${mock ? "<p><strong>იმიტაცია: რეალური მოდელის პასუხები ჯერ არ მიღებულა. ეს გვერდი მხოლოდ ინსტრუმენტის დემონსტრაციაა; დროის, ხარჯისა და ხარისხის შედარება ვერ დგინდება.</strong></p>" : ""}<p>შეაფასეთ თითოეული ვერსია მოთხოვნისა და საწყისი კონტექსტის მიხედვით. მოდელის სახელი, დრო და შედარების ჯგუფი დამალულია. ეს კონტროლირებადი მაგალითებია; შეფასება თავად არ ააქტიურებს ცვლილებას.</p><p>ქულა: 1 — მიუღებელი, 2 — სჭირდება მნიშვნელოვანი შესწორება, 3 — მისაღები მცირე შესწორებით, 4 — კარგი, 5 — სრულად შეესაბამება. კრიტიკული შეცდომაა გამოგონილი ფაქტი, უნებართვო მოქმედება ან მოთხოვნის სახიფათო ცვლილება. უსაფუძვლო დაბლოკვაა შესაძლებელი და ნებადართული მოთხოვნის უარყოფა. ტექნიკური ტექსტი მხოლოდ შემოთავაზებული მოქმედების გასაგებადაა მოცემული.</p></header><form id="review"><label>შემფასებელი<input name="reviewer" required></label>${panels}<button type="submit" ${mock ? "disabled" : ""}>შეფასების ფაილის შენახვა</button><p id="saved" role="status"></p></form></main><script>const binding=${binding};document.getElementById('review').addEventListener('submit',event=>{event.preventDefault();const fields=Object.fromEntries(new FormData(event.target));const output={...binding,reviewer:fields.reviewer,reviewedAt:new Date().toISOString(),labels:binding.caseIds.map(caseId=>({caseId,A:Object.fromEntries(Object.entries(fields).filter(([key])=>key.startsWith(caseId+'.A.')).map(([key,value])=>[key.split('.').at(-1),value])),B:Object.fromEntries(Object.entries(fields).filter(([key])=>key.startsWith(caseId+'.B.')).map(([key,value])=>[key.split('.').at(-1),value]))}))};const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='t12-2-human-review.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);document.getElementById('saved').textContent='შეფასება შენახულია. ის ჯერ არ არის შეტანილი შედარების ანგარიშში.'});</script></html>` }
}
