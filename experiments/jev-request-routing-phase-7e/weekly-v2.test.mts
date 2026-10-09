import test from "node:test"
import assert from "node:assert/strict"
import { weeklyBody } from "./weekly.mjs"
import { weeklyBodyV2,validateWeeklyV2 } from "./weekly-v2.mjs"
import { json } from "./common.mjs"
const users=await json("user-inputs.json"),refs=await json("user-reference.json")
test("supplement adds one counting-basis question without altering the frozen eleven",()=>{
 for(const c of users.items) {
  const old=weeklyBody(c.text),newBody=weeklyBodyV2(c.text),{cadenceBasis,...priorQuestions}=newBody.questions
  assert.deepEqual(priorQuestions,old.questions);assert.deepEqual(newBody.state,old.state)
  assert.equal(cadenceBasis.type,"choice");assert.equal(Object.keys(newBody.questions).length,12)
 }
})
test("per-week basis remains distinct from aggregate and retains caller source quantities",()=>{
 const c=users.items[2],ref=refs.items[2],expected={...ref.required,...ref.engineeringNegatives,cadenceBasis:"perWeekAcrossRange"},body=weeklyBodyV2(c.text)
 const raw={model:body.model,answers:Object.fromEntries(Object.entries(body.questions).map(([key,q])=>[key,{type:"choice",choice:expected[key],confidence:1,probabilities:Object.fromEntries(Object.keys(q.criteria).map(k=>[k,k===expected[key]?1:0]))}])),usage:{input_tokens:1,output_tokens:1}}
 const r=validateWeeklyV2(raw,c.text)
 assert.equal(r.observation.cadenceBasis,"perWeekAcrossRange");assert.equal(r.observation.calendarInterval,null)
 assert.equal(r.observation.channels.instagram?.quantity,2)
 delete (raw.answers as Record<string,unknown>).cadenceBasis
 assert.throws(()=>validateWeeklyV2(raw,c.text))
})
