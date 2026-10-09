import assert from 'node:assert/strict'
import test from 'node:test'
import {prepareContextualNote} from '../src/application/contextual-notes/workflow'
import type {Interpretation} from '../src/application/contextual-notes/model'
const input={id:'11111111-1111-4111-8111-111111111111',text:'  რატომ?\nხარისხი შეინარჩუნეთ.  ',source:'text' as const,context:{brandId:'brand',section:'overview' as const,week:'2026-10-05',postKey:null,channel:null,runId:null}}
const data={planning:{run:null,approved:null,history:[],basis:null,stale:false},dossier:null,strategy:{active:null},history:[],screenData:null,activeRules:[]}
const meaning:Interpretation={statements:[{quote:'რატომ?',meaning:'განმარტების მოთხოვნა',kind:'question',scope:'screen',actionable:false},{quote:'ხარისხი შეინარჩუნეთ.',meaning:'ხარისხის შენარჩუნება',kind:'preference',scope:'screen',actionable:false}],response:'განმარტება',clarification:'',action:'none',instruction:'',ambiguous:false,weeklyDirectives:null}
test('the separate interpretation port receives the complete original message and retains every meaning',async()=>{
 const result=await prepareContextualNote(input,data,{reason:async()=>{throw Error('No writer should be called')},interpret:async received=>{assert.equal(received.message,input.text);return meaning},channelImpact:async()=>({affectedFuture:0,unresolved:0}),channelPolicies:async()=>[]})
 assert.equal(result.status,'answered');assert.equal(result.interpretation.statements.length,2);assert.equal(result.snapshot,null)
})
test('an alternate interpreter cannot use history quotes or skip the shared interpretation contract',async()=>{
 await assert.rejects(prepareContextualNote(input,data,{reason:async()=>{throw Error('No writer')},interpret:async()=>({...meaning,statements:[{...meaning.statements[0]!,quote:'სხვა ტექსტი'}]}),channelImpact:async()=>({affectedFuture:0,unresolved:0}),channelPolicies:async()=>[]}),/ცვლილება არ შესრულდა/)
})
