import type { PostCopy, PostsReview } from "../../src/blueprints/social/weekly-planning/posts"
import type { ShadowCollectionInput } from "../../src/application/semantic-middleware/collect-shadow"
import { controlledSentenceTask } from "../../src/blueprints/social/semantic-middleware/shadow-task"
import { sha256 } from "./common.mjs"
export type SourceItem = { sourceId:string;sourceRevision:string;createdAt:string;sourceKind:"savedCopy"|"repairDraft";runId:string;postKey:string;copy:PostCopy;serviceMentions:string[];
  writerReceipts:readonly {id:string;step:string;promptVersion:string;model:string;createdAt:string;inputHash:string}[];review:PostsReview|null }
export type SampleItem = SourceItem & {itemId:string;cohort:"A"|"B";contentHash:string;selectionTags:string[];surfaces:readonly {surface:string;channel:string;text:string;textHash:string}[]}
export const SELECTION_VERSION="phase7d-deterministic-real-posts-v1"
export function contentSurfaces(copy:PostCopy) {
 return copy.variants.flatMap(v=>[{surface:"caption",channel:v.channel,text:v.caption},{surface:"script",channel:v.channel,text:v.script},
  ...v.frames.flatMap((f,i)=>[{surface:"frames."+i+".heading",channel:v.channel,text:f.heading},{surface:"frames."+i+".body",channel:v.channel,text:f.body}]),
  ...v.onScreenText.map((text,i)=>({surface:"onScreenText."+i,channel:v.channel,text}))]).filter(s=>typeof s.text==="string"&&s.text.trim()).map(s=>({...s,textHash:sha256(s.text)}))
}
export function selectionTags(text:string) {
 const rules:Record<string,RegExp>={price:/ფას|ლარ|ღირებულ|GEL|₾/iu,discount:/ფასდაკლებ|აქცი|შეღავათ|%/u,availability:/თავისუფალ.{0,20}ადგილ|ადგილ.{0,20}(არის|დარჩ|შევს)|სლოტ|ჩაწერ|დაჯავშნ|ჯავშან/u,
  negation:/(^|\s)(არ|აღარ|ვერ)(\s|[,.!?])|შეუძლებ/u,temporal:/გასულ|მომავალ|დღეს|ახლა|წელს|კვირ/u,branch:/ფილიალ|ვაკე|საბურთალო/u,contrastOrEllipsis:/თუმცა|ხოლო|მაგრამ|[—–]/u}
 return Object.entries(rules).filter(([,r])=>r.test(text)).map(([name])=>name)
}
export function selectSample(items:readonly SourceItem[],aLimit=50,bLimit=25) {
 const ordered=[...items].filter(i=>i.writerReceipts.length&&i.copy.variants.length&&/[\u10a0-\u10ff]/u.test(contentSurfaces(i.copy).map(s=>s.text).join("\n"))).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.sourceId.localeCompare(b.sourceId))
 const seen=new Set<string>(), unique=ordered.flatMap(i=>{const surfaces=contentSurfaces(i.copy),contentHash=sha256(JSON.stringify(surfaces.map(({surface,channel,text})=>({surface,channel,text}))));if(seen.has(contentHash))return[];seen.add(contentHash);return[{...i,contentHash,surfaces,selectionTags:selectionTags(surfaces.map(s=>s.text).join("\n"))}]})
 const a=unique.filter(i=>i.sourceKind==="savedCopy").slice(0,aLimit),aIds=new Set(a.map(i=>i.sourceId))
 const b=unique.filter(i=>!aIds.has(i.sourceId)&&i.selectionTags.length).slice(0,bLimit)
 return {eligibleSourcePool:ordered.length,uniqueContentPool:unique.length,items:[...a.map((i,n)=>({...i,itemId:"A"+String(n+1).padStart(3,"0"),cohort:"A" as const})),...b.map((i,n)=>({...i,itemId:"B"+String(n+1).padStart(3,"0"),cohort:"B" as const}))]}
}
export function sampleInputs(item:SampleItem):ShadowCollectionInput[] {
 return item.surfaces.map(s=>{const source={sourceId:item.sourceId+"/"+s.channel+"/"+s.surface,revisionId:s.textHash,text:s.text};return{source,task:controlledSentenceTask(source,item.itemId+"/"+s.channel+"/"+s.surface,item.serviceMentions),
  linkage:{workflowRunId:item.runId,reviewRunId:"phase7d:"+item.sourceRevision,postKey:item.postKey,channel:s.channel,surface:s.surface,committedStep:"offlineFrozenEvaluation",
    safetyReviewer:{promptVersion:"unavailable-original-safety",outcome:null},consolidatedReviewer:{outcome:item.review?{summary:item.review.summary,issues:item.review.issues.filter(i=>i.postKey===item.postKey)}:null}}}})
}
