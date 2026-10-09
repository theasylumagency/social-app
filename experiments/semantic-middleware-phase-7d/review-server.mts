import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { randomBytes } from "node:crypto"
import path from "node:path"
import { experiment,json,save } from "./common.mjs"
import { validateHumanReference,verifyFrozen,type HumanReference } from "./review.mjs"
await verifyFrozen()
const queue=await json("review/queue.json"),csrf=randomBytes(24).toString("hex")
const server=createServer(async(req,res)=>{
 res.setHeader("Cache-Control","no-store");res.setHeader("X-Content-Type-Options","nosniff")
 res.setHeader("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self'")
 try {
  if(req.method==="GET"&&req.url==="/"){res.setHeader("Content-Type","text/html; charset=utf-8");res.end((await readFile(path.join(experiment,"review.html"),"utf8")).replace("__CSRF__",csrf));return}
  if(req.method==="GET"&&req.url==="/queue"){res.setHeader("Content-Type","application/json");res.end(JSON.stringify(queue));return}
  if(req.method==="GET"&&req.url==="/draft"){let draft=null;try{draft=await json("review/draft.json")}catch{}res.setHeader("Content-Type","application/json");res.end(JSON.stringify(draft));return}
  if(req.method==="POST"&&["/draft","/reference"].includes(req.url??"")) {
   const address=server.address();const origin=typeof address==="object"&&address?"http://127.0.0.1:"+address.port:""
   if(req.headers.origin!==origin||req.headers["x-review-csrf"]!==csrf){res.statusCode=403;res.end("Local review access required.");return}
   if(req.headers["content-type"]!=="application/json"){res.statusCode=415;res.end("JSON required.");return}
   const chunks:Buffer[]=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>1_000_000)throw Error("Review too large");chunks.push(chunk)}
   const reference=JSON.parse(Buffer.concat(chunks).toString("utf8")) as HumanReference
   const complete=req.url==="/reference",errors=validateHumanReference(reference,queue,complete)
   if(errors.length){res.statusCode=422;res.setHeader("Content-Type","application/json");res.end(JSON.stringify({errors}));return}
   if(complete){reference.completedAt=new Date().toISOString();await save("review/reference.json",reference,true);await save("review/completion.json",{completedAt:reference.completedAt,sampleHash:reference.sampleHash,humanCreated:true,blindAttestation:reference.blindAttestation},true)}
   else await save("review/draft.json",reference)
   res.setHeader("Content-Type","application/json");res.end(JSON.stringify({saved:true,complete}));return
  }
  res.statusCode=404;res.end("No data here.")
 }catch(error){res.statusCode=400;res.setHeader("Content-Type","application/json");res.end(JSON.stringify({errors:[error&&typeof error==="object"&&"code"in error&&error.code==="EEXIST"?"A completed review is already saved; preserve it and use a new revision for corrections.":"Review could not be saved. Check the fields and try again."]}))}
})
server.listen(0,"127.0.0.1",async()=>{const address=server.address();if(!address||typeof address!=="object")throw Error("REVIEW_SERVER_ADDRESS");const url="http://127.0.0.1:"+address.port;await save("review/server-address.json",{url,purpose:"Temporary isolated blind review; no provider outputs served"});console.log(JSON.stringify({url,posts:queue.items.length,blind:true}))})
