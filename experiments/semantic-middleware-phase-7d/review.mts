import { readFile } from "node:fs/promises"
import path from "node:path"
import { experiment, json,root,sha256 } from "./common.mjs"
export const ACTIONS=["noActionDifference","reviewerFocusOnly","unnecessaryReviewOrRepair","missedNecessaryReviewOrRepair","wrongFactEntityBinding","potentiallyWrongPublicationHandling"] as const
export type HumanProposition={sourceId:string;excerpt:string;start:number;end:number;families:readonly ("price"|"discount"|"availability")[];polarity:"affirmed"|"negated"|"unresolved";
 service:{state:"notRequired"|"known"|"unresolved";mention:string};branch:{state:"notRequired"|"known"|"unresolved";mention:string};time:"notRequired"|"past"|"current"|"future"|"unresolved";
 amount:{state:"notRequired"|"known"|"unresolved";value:string;currency:string;basis:string};consumerRequired:readonly string[];sufficientForConsumer:boolean;consumers:readonly ("Safety reviewer"|"future Fact matcher"|"repair"|"none")[];
 errorCouldChangeHandling:"yes"|"no"|"unknown";ifMissedAction:typeof ACTIONS[number];ellipsis:readonly string[];notes:string}
export type HumanItem={itemId:string;reviewed:boolean;noMaterial:boolean;ineligibility:"correctlyIneligible"|"missedMaterial"|"missedImplicit"|"candidateOrAnchorFailure";propositions:readonly HumanProposition[];notes:string}
export type HumanReference={sampleId:string;sampleHash:string;referenceStatus:string;reviewer:string;completedAt:string|null;blindAttestation:boolean;items:readonly HumanItem[]}
export async function verifyFrozen() {
 const receipts=await json("frozen-files.json") as Record<string,string>
 for(const [file,hash] of Object.entries(receipts))if(sha256(await readFile(path.join(experiment,file)))!==hash)throw Error("FROZEN_SAMPLE_CHANGED")
 const manifest=await json("sample-manifest.json")
 for(const [file,hash] of Object.entries(manifest.codeHashes as Record<string,string>))if(sha256(await readFile(path.join(root,file)))!==hash)throw Error("FROZEN_PROTOCOL_CHANGED")
 const sample=await json("sample.json"),prepared=await json("prepared-tasks.json")
 if(sha256(JSON.stringify({...manifest.hashPayload,items:sample.items,frozenInputs:prepared.items}))!==manifest.sampleHash) {
  // Hash was frozen with a specific field order; reconstruct that order explicitly.
  const p=manifest.hashPayload
  if(sha256(JSON.stringify({sampleId:p.sampleId,version:p.version,createdAt:p.createdAt,selection:p.selection,items:sample.items,configuration:p.configuration,codeHashes:p.codeHashes,repeatSubset:p.repeatSubset,repeatPasses:p.repeatPasses,frozenInputs:prepared.items}))!==manifest.sampleHash)throw Error("SAMPLE_HASH_MISMATCH")
 }
 return {manifest,sample,prepared}
}
export function validateHumanReference(reference:HumanReference,queue:{sampleId:string;sampleHash:string;referenceStatus:string;items:readonly {itemId:string;surfaces:readonly {sourceId:string;text:string}[]}[]},complete=true):string[] {
 const errors:string[]=[]
 if(reference.sampleId!==queue.sampleId||reference.sampleHash!==queue.sampleHash)errors.push("Reference must match the frozen sample.")
 if(reference.referenceStatus!==queue.referenceStatus)errors.push("Preserve the engineering-reference status.")
 if(!Array.isArray(reference.items)||reference.items.length!==queue.items.length)return[...errors,"Review every frozen post."]
 if(complete&&(!reference.reviewer?.trim()||!reference.blindAttestation))errors.push("Enter your name and confirm the blind review.")
 if(new Set(reference.items.map(i=>i.itemId)).size!==reference.items.length)errors.push("Duplicate review item.")
 for(const expected of queue.items) {
  const item=reference.items.find(i=>i.itemId===expected.itemId)
  if(!item){errors.push("Missing post "+expected.itemId);continue}
  if(complete&&!item.reviewed)errors.push("Review post "+expected.itemId)
  if(!item.reviewed&&!complete)continue
  if(!["correctlyIneligible","missedMaterial","missedImplicit","candidateOrAnchorFailure"].includes(item.ineligibility))errors.push("Choose an eligibility finding for "+expected.itemId)
  if(!Array.isArray(item.propositions)){errors.push("Invalid proposition list.");continue}
  if(item.noMaterial!==!item.propositions.length)errors.push("Confirm no relevant proposition or add the relevant propositions for "+expected.itemId)
  if(item.noMaterial&&item.ineligibility!=="correctlyIneligible")errors.push("No relevant proposition must be marked correctly ineligible.")
  if(item.propositions.length&&item.ineligibility==="correctlyIneligible")errors.push("A relevant proposition in this no-call sample requires a missed-proposition finding.")
  for(const p of item.propositions) {
   const source=expected.surfaces.find(s=>s.sourceId===p.sourceId)
   if(!source||!Number.isInteger(p.start)||!Number.isInteger(p.end)||p.start<0||p.end<=p.start||Array.from(source.text).slice(p.start,p.end).join("")!==p.excerpt)errors.push("Quote an exact source span for "+expected.itemId)
   if(!Array.isArray(p.families)||!p.families.length||new Set(p.families).size!==p.families.length||p.families.some((f:string)=>!["price","discount","availability"].includes(f)))errors.push("Choose a supported family.")
   if(!["affirmed","negated","unresolved"].includes(p.polarity))errors.push("Choose polarity.")
   for(const b of [p.service,p.branch])if(!b||!["notRequired","known","unresolved"].includes(b.state)||(b.state==="known"&&!b.mention.trim()))errors.push("Complete service/branch binding.")
   if(!["notRequired","past","current","future","unresolved"].includes(p.time))errors.push("Choose temporal state without calendar resolution.")
   if(!p.amount||!["notRequired","known","unresolved"].includes(p.amount.state)||(p.amount.state==="known"&&(!p.amount.value.trim()||!p.amount.basis.trim())))errors.push("Complete amount/basis.")
   if(!Array.isArray(p.consumerRequired)||p.consumerRequired.some((f:string)=>!["family","polarity","service","branch","time","amount","unresolved"].includes(f)))errors.push("Invalid consumer-required fields.")
   if(typeof p.sufficientForConsumer!=="boolean"||!Array.isArray(p.consumers)||!p.consumers.length||p.consumers.some((c:string)=>!["Safety reviewer","future Fact matcher","repair","none"].includes(c))||(p.consumers.includes("none")&&p.consumers.length>1))errors.push("Choose consumer usefulness.")
   if(!["yes","no","unknown"].includes(p.errorCouldChangeHandling)||!ACTIONS.includes(p.ifMissedAction))errors.push("Choose potential action impact.")
   if(!Array.isArray(p.ellipsis)||p.ellipsis.some((e:string)=>!["omittedService","omittedRelation","sharedAntecedent","contrastiveBranch","competingAntecedents"].includes(e)))errors.push("Invalid ellipsis category.")
  }
 }
 return [...new Set(errors)]
}
export async function completedReference():Promise<HumanReference|null> {
 try{const ref=await json("review/reference.json") as HumanReference,queue=await json("review/queue.json");if(!ref.completedAt||validateHumanReference(ref,queue).length)throw Error("HUMAN_REFERENCE_INCOMPLETE");return ref}
 catch(error){if(error&&typeof error==="object"&&"code"in error&&error.code==="ENOENT")return null;throw error}
}
