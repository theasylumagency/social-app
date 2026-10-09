import assert from 'node:assert/strict'
import test from 'node:test'
import {act,createElement} from 'react'
import {createRoot} from 'react-dom/client'
import {JSDOM} from 'jsdom'
import {SocialScheduleControls} from '../src/app/workspace/social-schedule-controls'
import {weeklyApprovalFixture} from './weekly-approval-fixture'
import type {PostRevisionView} from '../src/application/post-revisions/model'
test('a reviewed revision requires its own decision before an explicit schedule replacement',async t=>{
 const {run,posts}=weeklyApprovalFixture();run.week='2030-01-07'
 const variant=posts.payload.copies.p1!.variants[0]!
 const revision:PostRevisionView={id:'11111111-1111-4111-8111-111111111111',postKey:'p1',channel:'facebook',version:2,status:'ready',updatedAt:'2026-10-08T01:00:00.000Z',error:null,batchTitle:'Shortened checklist',approvalId:null,before:variant,after:{...variant,caption:'Whole item, then a close view.'},issues:[]}
 const old={publicationInputId:'old-input',supersededByInputId:null,approvalId:posts.approvalEvidence!.id,postKey:'p1',publishingAccountId:'account',schedule:{id:'old-schedule',channel:'facebook',publishAt:'2030-01-07T08:00:00Z',draftVersion:1},lifecycle:{status:'scheduled',revision:0},delivery:{state:'notStarted',attemptCount:0}}
 let reads=0,decisions=0,saves=0,payload:Record<string,unknown>={},finish!:()=>void
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'})
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(url:string,options?:RequestInit)=>{
  if(!options?.method){reads++;return Response.json({capturedAt:'2029-12-01T00:00:00Z',accounts:[{id:'account',channel:'facebook',name:'Page',connected:true,canPublish:true}],schedules:[old],revisions:[revision]})}
  if(url==='/api/post-revisions'){decisions++;await new Promise<void>(resolve=>{finish=resolve});revision.status='approved';revision.approvalId='new-approval';return Response.json({saved:true})}
  saves++;payload=JSON.parse(String(options.body));return Response.json({count:1},{status:201})
 }}
 const originals=Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)] as const)
 for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,value})
 const root=createRoot(dom.window.document.getElementById('root')!);t.after(async()=>{await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key)}})
 await act(async()=>root.render(createElement(SocialScheduleControls,{run,batch:posts,assets:[]})))
 assert.equal(reads,1);assert.equal(decisions,0)
 const button=(text:string)=>[...dom.window.document.querySelectorAll('button')].find(b=>b.textContent===text)!
 await act(async()=>button('ახალი ტექსტის დამტკიცება').click());assert.equal(decisions,0)
 await act(async()=>{const final=button('ახალი ტექსტის დამტკიცების დადასტურება');final.click();final.click()});assert.equal(decisions,1);assert.equal(saves,0)
 await act(async()=>finish());assert.equal(saves,0,'the approval does not replace an existing schedule')
 assert.ok(dom.window.document.body.textContent!.includes('ახალი ტექსტი · ვერსია 2'))
 await act(async()=>{const account=dom.window.document.querySelector('select')!;account.value='account';account.dispatchEvent(new dom.window.Event('change',{bubbles:true}))})
 await act(async()=>{const checkbox=dom.window.document.querySelector('input[type="checkbox"]') as HTMLInputElement;assert.equal(checkbox.disabled,false);checkbox.click()})
 await act(async()=>button('არჩეული განრიგის გადამოწმება').click());assert.equal(saves,0)
 await act(async()=>button('ჯგუფის განრიგის დადასტურება').click());assert.equal(saves,1)
 assert.deepEqual(payload.replaceInputIds,['old-input']);assert.equal((payload.selections as Record<string,unknown>[])[0]!.revisionId,revision.id)
 assert.equal(old.supersededByInputId,null,'the mock historical record is never edited by the client')
})
