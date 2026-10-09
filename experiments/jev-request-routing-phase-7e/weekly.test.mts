import test from "node:test"
import assert from "node:assert/strict"
import { numberCandidates, weeklyBody, weeklyObservation, validateWeekly, applyCadenceMath } from "./weekly.mjs"
import { validateChoice } from "./transport-v2.mjs"
import { json } from "./common.mjs"
const users = await json("user-inputs.json"), refs = await json("user-reference.json")
test("exact supplied quantities distinguish video count, uncertain week and channel deltas", () => {
 const text = users.items[4].text, candidates = numberCandidates(text)
 assert.deepEqual(candidates.map(c => [c.id,c.excerpt,c.quantity]), [["n1","ორ",2],["n2","ერთი",1],["n3","ერთით",1],["n4","ორით",2]])
 for (const c of candidates) assert.equal(Array.from(text).slice(c.start,c.end).join(""),c.excerpt)
})
test("Georgian repeated counts and duration are grounded separately", () => {
 assert.deepEqual(numberCandidates(users.items[2].text).map(c => c.quantity), [{low:3,high:4},2])
 assert.equal(numberCandidates(users.items[3].text)[0]?.excerpt,"თითო-თითო")
 assert.equal(numberCandidates("რიცხვი სიტყვაში ერთია")[0],undefined)
 assert.throws(() => numberCandidates("1 2 3 4 5 6 7 8 9"))
})
function response(index: number) {
 const text = users.items[index].text, ref = refs.items[index], expected = {...ref.required,...ref.engineeringNegatives}, body = weeklyBody(text)
 return {model:body.model,answers:Object.fromEntries(Object.entries(body.questions).map(([key,q]) => [key,{type:"choice",choice:expected[key],confidence:1,probabilities:Object.fromEntries(Object.keys(q.criteria).map(k=>[k,k===expected[key]?1:0]))}])),usage:{input_tokens:1,output_tokens:1}}
}
test("all reference bindings yield source-owned observations, no final counts or date", () => {
 for (let i=0;i<5;i++) {
  const text = users.items[i].text, r = validateWeekly(response(i),text), observation = weeklyObservation(text,r.answers)
  assert.deepEqual(observation.consistencyIssues,[])
  assert.equal(observation.originalText,text)
  assert.equal(observation.calendarInterval,null)
  assert.equal(observation.resultingCounts,null)
  assert.equal(observation.applicationReadiness,"unverifiedPlanNoExecution")
 }
})
test("calendar reference remains absent in requests even with relative phrases", () => {
 const body = weeklyBody(users.items[4].text)
 assert.equal(body.state.ui_context.calendar_reference,null)
 assert.equal(body.state.ui_context.baseline_counts,null)
 assert.equal(body.state.ui_context.selected_plan_verified,false)
 assert.equal(Object.keys(body.questions).length,11)
})
test("schema defects are technical failures, not uncertainty", () => {
 const r = response(0)
 delete (r.answers as Record<string,unknown>).format
 assert.throws(()=>validateWeekly(r,users.items[0].text))
 assert.throws(()=>validateChoice({type:"choice",choice:"x",probabilities:{x:0,y:0},confidence:0},["x","y"]))
})
test("native rounded probabilities remain raw", () => {
 const r = validateChoice({type:"choice",choice:"a",probabilities:{a:.81,b:.15,c:.02,d:.01},confidence:.81},["a","b","c","d"])
 assert.deepEqual(r.probabilities,{a:.81,b:.15,c:.02,d:.01})
})
test("delta arithmetic needs real baselines; delegation needs planner", () => {
 const delta = {facebook:{mode:"increase",quantity:1},instagram:{mode:"decrease",quantity:2}}
 assert.equal(applyCadenceMath(delta,null).ready,false)
 assert.deepEqual(applyCadenceMath(delta,{facebook:3,instagram:4}).counts,{facebook:4,instagram:2})
 assert.equal(applyCadenceMath({facebook:{mode:"delegate",quantity:null},instagram:{mode:"set",quantity:2}},null).ready,false)
})
test("existing cadence bounds and invalid arithmetic cannot become executable results", () => {
 const delta = {facebook:{mode:"increase",quantity:1},instagram:{mode:"decrease",quantity:2}}
 assert.equal(applyCadenceMath(delta,{facebook:5,instagram:1}).ready,false)
 assert.equal(applyCadenceMath(delta,{facebook:3.5,instagram:4}).ready,false)
 assert.equal(applyCadenceMath({facebook:{mode:"set",quantity:-1},instagram:{mode:"set",quantity:2}},null).ready,false)
})
