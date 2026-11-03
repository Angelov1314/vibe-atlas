import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
// Test-only resolver: production uses bundler extension resolution; no copied runtime modules.
registerHooks({resolve(specifier,context,nextResolve){
  if(specifier.startsWith('.') && !extname(specifier) && context.parentURL?.includes('/lib/'))
    return nextResolve(specifier+'.ts',context);
  return nextResolve(specifier,context);
}});
const { seedScore, communityScore, communityFromHistogram, riskWeight, arenaElo, percentile } = await import('../lib/ranking.ts');
const { submitProjectVote, getCommunityStatus, submitAppeal, resolveAppeal, createArenaAssignment,
  getArenaMedia, submitArenaVote, reviewArenaSamples, ensureIdentity, verifyTurnstile, readArenaLeaderboard } = await import('../lib/community.ts');
const {uniqueRepositories,measuredGrowth,collectGitHub,importX}=await import('../scripts/collect-metrics.mjs');

class Statement {
  constructor(db,sql,values=[]) {this.db=db;this.sql=sql;this.values=values;}
  bind(...values){return new Statement(this.db,this.sql,values);}
  async first(){return this.db.sqlite.prepare(this.sql).get(...this.values)??null;}
  async all(){return {success:true,results:this.db.sqlite.prepare(this.sql).all(...this.values)};}
  async run(){const result=this.db.sqlite.prepare(this.sql).run(...this.values);return {success:true,meta:{changes:result.changes}};}
}
class LocalD1 {
  constructor(){this.sqlite=new DatabaseSync(':memory:');this.sqlite.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));}
  prepare(sql){return new Statement(this,sql);}
  async batch(statements){
    this.sqlite.exec('BEGIN TRANSACTION');
    try {
      const results=statements.map(s=>{
        const rows=this.sqlite.prepare(s.sql).all(...s.values);
        const changes=this.sqlite.prepare('SELECT changes() AS changes').get().changes;
        return {success:true,results:rows,meta:{changes}};
      });
      this.sqlite.exec('COMMIT');return results;
    } catch(error){this.sqlite.exec('ROLLBACK');throw error;}
  }
}
const config=(overrides={})=>({db:new LocalD1(),identity:{subject:'test-user-1',provider:'verified-site-platform',verified:true},
  origin:'https://atlas.example',identityHmacSecret:'test-only-not-a-production-key-1234567890',
  validItemIds:new Set(['threejs','godot']),now:()=>1793577600000,...overrides});
const request=(body,origin='https://atlas.example')=>new Request('https://atlas.example/api/vote',{
  method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
const simpleSignals={accountAgeDays:0,verifiedUsageCount:0,requestsLastMinute:1,requestsLastDay:1};

test('missing popularity data stays absent, not fabricated zero or market-leading percentile',()=>{
  const empty=seedScore({});assert.equal(empty.score,null);assert.equal(empty.coverage,0);
  const observed=seedScore({stars:40000,observedAt:'2026-11-02T00:00:00Z'}, {},new Date('2026-11-02'));
  assert.equal(observed.coverage,.45);assert.equal(observed.components[4].value,null);
  assert.equal(percentile(50,[50]),null);
  const incompleteX=seedScore({xUniqueAuthors30d:10,xWindowComplete:false});assert.equal(incompleteX.score,null);
  const measuredZero=seedScore({xUniqueAuthors30d:0,xWindowComplete:true});assert.equal(measuredZero.score,0);
});

test('community cold start stays unrated and one five-star vote remains strongly shrunk',()=>{
  assert.equal(communityScore([]).score,null);
  const single=communityScore([{rating:5,weight:1}]);assert.ok(single.stars<3.2);assert.equal(single.status,'provisional');
  const credible=communityScore(Array.from({length:100},(_,i)=>({rating:5,weight:1,identityId:`u${i}`})));
  assert.ok(credible.lower95>single.lower95);assert.ok(credible.stars>4.7);
});

test('uniformly tiny weights do not create false evidence or confidence',()=>{
  const weak=communityScore(Array.from({length:100},()=>({rating:5,weight:.01})));
  const one=communityScore([{rating:5,weight:1}]);
  assert.equal(weak.kishEffectiveN,100);assert.equal(weak.informationN,1);assert.equal(weak.score,one.score);
  assert.throws(()=>communityScore([{rating:5,weight:1,identityId:'same'},{rating:5,weight:1,identityId:'same'}]));
  const histogram=communityFromHistogram([0,0,0,0,1],1,1);assert.equal(histogram.stars,one.stars);
});

test('new accounts are allowed; independent high-risk signals quarantine; no IP penalty exists',()=>{
  const good=riskWeight(simpleSignals);assert.equal(good.decision,'accept');assert.equal(good.weight,.45);
  const campaign=riskWeight({...simpleSignals,requestsLastMinute:6,rapidRepeatedSequence:true,campaignCorrelation:.9});
  assert.equal(campaign.decision,'quarantine');assert.equal(campaign.weight,0);
  assert.equal(riskWeight({...simpleSignals,replayedNonce:true}).decision,'reject');
});

test('Arena requires real blinded outputs and isolates modality/protocol',()=>{
  assert.equal(arenaElo([],'image','p1').models.length,0);
  const base={id:'b1',modelA:'a',modelB:'b',winner:'a',weight:1,modality:'image',protocolHash:'p1',
    outputAHash:'ha',outputBHash:'hb',blinded:true,ratedAt:'2026-11-02'};
  const ranked=arenaElo([base,{...base,id:'b2',protocolHash:'p2'},{...base,id:'b3',blinded:false}],'image','p1');
  assert.equal(ranked.totalBattles,1);assert.equal(ranked.models[0].id,'a');
  const disconnected=arenaElo([base,{...base,id:'b4',modelA:'c',modelB:'d'}],'image','p1');
  assert.equal(disconnected.crossComponentRankingAllowed,false);
});

test('server identity, Origin and catalog membership are mandatory',async()=>{
  assert.equal((await submitProjectVote(request({itemId:'threejs',rating:5}),config({identity:null}))).status,401);
  assert.equal((await submitProjectVote(request({itemId:'threejs',rating:5},'https://evil.example'),config())).status,403);
  assert.equal((await submitProjectVote(request({itemId:'invented',rating:5}),config())).status,404);
  assert.equal((await submitProjectVote(request({itemId:'threejs',rating:6}),config())).status,400);
});

test('SQL unique vote updates existing rating and ignores browser-supplied identity/weight',async()=>{
  const c=config();
  const first=await submitProjectVote(request({itemId:'threejs',rating:5,userId:'spoof',weight:100}),c);
  assert.equal(first.status,200);const f=await first.json();assert.equal(f.weight,.45);assert.equal(f.summary.voters,1);
  const updated=await submitProjectVote(request({itemId:'threejs',rating:1}),c);assert.equal(updated.status,200);
  const data=await updated.json();assert.equal(data.summary.voters,1);assert.ok(data.summary.stars<3);
  const rows=c.db.sqlite.prepare('SELECT * FROM project_votes').all();assert.equal(rows.length,1);assert.equal(rows[0].rating,1);
  assert.notEqual(rows[0].identity_id,'spoof');
  assert.equal(c.db.sqlite.prepare('SELECT COUNT(*) AS n FROM vote_audit').get().n,2);
});

test('D1 atomic counters cap vote bursts',async()=>{
  const c=config();let response;
  for(let i=0;i<7;i++)response=await submitProjectVote(request({itemId:'godot',rating:4}),c);
  assert.equal(response.status,429);assert.ok(Number(response.headers.get('retry-after'))>0);
  assert.equal(c.db.sqlite.prepare('SELECT COUNT(*) AS n FROM project_votes').get().n,1);
});

test('required challenge fails closed when unavailable and validates hostname/action',async()=>{
  const c=config({challengeMode:'required'});
  assert.equal((await submitProjectVote(request({itemId:'threejs',rating:5}),c)).status,503);
  assert.equal(c.db.sqlite.prepare('SELECT COUNT(*) AS n FROM project_votes').get().n,0);
  const challenge={...c,turnstileSecret:'secret',fetcher:async()=>Response.json({success:true,hostname:'evil.example',action:'project_vote'})};
  assert.equal(await verifyTurnstile('token',challenge,'project_vote'),false);
  challenge.fetcher=async()=>Response.json({success:true,hostname:'atlas.example',action:'arena_vote'});
  assert.equal(await verifyTurnstile('token',challenge,'project_vote'),false);
  challenge.fetcher=async()=>Response.json({success:true,hostname:'atlas.example',action:'project_vote'});
  assert.equal(await verifyTurnstile('token',challenge,'project_vote'),true);
});

test('quarantined votes persist without affecting score; appeals require explicit admin',async()=>{
  const c=config({loadCampaignSignals:async()=>({rapidRepeatedSequence:true,campaignCorrelation:.95})});
  const response=await submitProjectVote(request({itemId:'threejs',rating:5}),c);
  const result=await response.json();assert.equal(result.status,'quarantined');assert.equal(result.summary.score,null);
  const appealResponse=await submitAppeal(request({itemId:'threejs',explanation:'这是一次真实使用后的评价，请重新审核这次风险判断。'}),c);
  assert.equal(appealResponse.status,200);const appeal=await appealResponse.json();
  const resolveBody={appealId:appeal.appeal.id,decision:'restore',resolution:'人工确认真实使用后恢复评价权重。'};
  assert.equal((await resolveAppeal(request(resolveBody),c)).status,503);
  assert.equal((await resolveAppeal(request(resolveBody),{...c,adminSubject:'administrator'})).status,403);
  assert.equal((await resolveAppeal(request(resolveBody),{...c,adminSubject:c.identity.subject})).status,200);
  const state=await(await getCommunityStatus(c,'threejs')).json();assert.equal(state.myVote.status,'accepted');
});

async function samplePair(c,{verified=true,samePrompt=true}={}) {
  const user=await ensureIdentity({...c,identity:{...c.identity,subject:'sample-uploader'}});
  c.db.sqlite.prepare('INSERT INTO arena_protocols(hash,modality,definition_json,created_at) VALUES(?,?,?,?)').run('p1','image','{}',c.now());
  for(let i=0;i<2;i++)c.db.sqlite.prepare(`INSERT INTO arena_samples(id,model_id,model_revision,protocol_hash,prompt_hash,
    output_sha256,object_key,submitted_by,media_type,byte_size,parameters_json,provenance_status,consent_to_publish,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(`s${i}`,`model${i}`,'rev1','p1',samePrompt?'prompt':`prompt${i}`,
      `hash${i}`,`private/output${i}.png`,user.id,'image/png',100,'{}',verified?'verified':'pending',1,c.now());
}

test('Arena starts empty and excludes unreviewed or incomparable samples',async()=>{
  const c=config();assert.equal((await(await createArenaAssignment(c,'p1')).json()).assignment,null);
  await samplePair(c,{verified:false});assert.equal((await(await createArenaAssignment(c,'p1')).json()).assignment,null);
  const other=config();await samplePair(other,{samePrompt:false});assert.equal((await(await createArenaAssignment(other,'p1')).json()).assignment,null);
});

test('Arena performs actual blind assignment, scope checks, atomic one-vote evidence and reveal',async()=>{
  const c=config();await samplePair(c);
  const assignment=(await(await createArenaAssignment(c,'p1')).json()).assignment;
  assert.ok(assignment.id);assert.equal(assignment.modelA,undefined);assert.equal(assignment.modelB,undefined);
  assert.ok((await getArenaMedia(c,assignment.id,'a')).object_key);
  const other={...c,identity:{...c.identity,subject:'another-user'}};
  assert.equal(await getArenaMedia(other,assignment.id,'a'),null);
  assert.equal((await submitArenaVote(request({assignmentId:assignment.id,winner:'a'}),other)).status,404);
  const result=await submitArenaVote(request({assignmentId:assignment.id,winner:'a'}),c);assert.equal(result.status,200);
  const outcome=await result.json();assert.ok(outcome.models.a);assert.ok(outcome.models.b);
  assert.equal(c.db.sqlite.prepare('SELECT COUNT(*) AS n FROM arena_votes').get().n,1);
  assert.equal((await submitArenaVote(request({assignmentId:assignment.id,winner:'a'}),c)).status,409);
  assert.equal((await(await createArenaAssignment(c,'p1')).json()).assignment,null);
});

test('Arena admin cannot be claimed by first visitor; revoked outputs cannot receive votes',async()=>{
  const c=config();await samplePair(c);
  const assignment=(await(await createArenaAssignment(c,'p1')).json()).assignment;
  const body={sampleIds:['s0'],decision:'rejected'};
  assert.equal((await reviewArenaSamples(request(body),c)).status,503);
  assert.equal((await reviewArenaSamples(request(body),{...c,adminSubject:'other-admin'})).status,403);
  assert.equal((await reviewArenaSamples(request(body),{...c,adminSubject:c.identity.subject})).status,200);
  assert.equal((await submitArenaVote(request({assignmentId:assignment.id,winner:'a'}),c)).status,409);
  assert.equal(c.db.sqlite.prepare('SELECT COUNT(*) AS n FROM arena_votes').get().n,0);
});

test('revoking a previously scored Arena sample removes its evidence from the live leaderboard',async()=>{
  const c=config();await samplePair(c);
  const assignment=(await(await createArenaAssignment(c,'p1')).json()).assignment;
  await submitArenaVote(request({assignmentId:assignment.id,winner:'a'}),c);
  assert.equal((await readArenaLeaderboard(c.db,'p1')).totalBattles,1);
  await reviewArenaSamples(request({sampleIds:['s0'],decision:'rejected'}),{...c,adminSubject:c.identity.subject});
  assert.equal((await readArenaLeaderboard(c.db,'p1')).totalBattles,0);
});

test('sample uploaders are excluded from their own blinded comparisons',async()=>{
  const c=config({identity:{subject:'sample-uploader',provider:'verified-site-platform',verified:true}});await samplePair(c);
  assert.equal((await(await createArenaAssignment(c,'p1')).json()).assignment,null);
});

test('request byte limit stops unbounded chunked streams before materializing the body',async()=>{
  let cancelled=false,chunks=0;
  const stream=new ReadableStream({pull(controller){chunks++;controller.enqueue(new Uint8Array(4096));},cancel(){cancelled=true;}});
  const req=new Request('https://atlas.example/api/vote',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://atlas.example'},body:stream,duplex:'half'});
  assert.equal((await submitProjectVote(req,config())).status,413);
  assert.equal(cancelled,true);assert.ok(chunks<=4);
});

test('collector deduplicates repository aliases and requires real 30-day snapshot history',()=>{
  const repos=uniqueRepositories([{projects:[{id:'a',github:'https://github.com/Owner/Repo'},{id:'b',github:'https://github.com/owner/repo/tree/main'}]}]);
  assert.equal(repos.length,1);assert.deepEqual(repos[0].itemIds,['a','b']);
  const current={ok:true,repo:'owner/repo',stars:120,observedAt:'2026-11-02T12:00:00Z'};
  const history=[{repositories:{'owner/repo':{ok:true,stars:100,observedAt:'2026-10-03T12:00:01Z'}}}];
  assert.equal(measuredGrowth(current,history).starsGained30d,null);
  history[0].repositories['owner/repo'].observedAt='2026-10-03T12:00:00Z';
  assert.equal(measuredGrowth(current,history).starsGained30d,20);
  assert.equal(measuredGrowth(current,history).windowDays,30);
  history[0].repositories['owner/repo'].stars=140;
  assert.equal(measuredGrowth(current,history).netStarChange,-20);
  assert.equal(measuredGrowth(current,history).starsGained30d,0);
});

test('collector stops on throttling, leaves unattempted repositories missing, and never writes the token',async()=>{
  let calls=0;
  const result=await collectGitHub([{repo:'a/one',itemIds:['one']},{repo:'b/two',itemIds:['two']}],{
    token:'TEST_SECRET_MUST_NOT_BE_PERSISTED',fetcher:async(_url,options)=>{
      calls++;assert.equal(options.headers.Authorization,'Bearer TEST_SECRET_MUST_NOT_BE_PERSISTED');
      return Response.json({message:'API rate limit exceeded'}, {status:403,headers:{'x-ratelimit-remaining':'0'}});
    }});
  assert.equal(calls,1);assert.equal(result.stoppedReason,'github_rate_limited');
  assert.equal(result.repositories['b/two'].missingReason,'not_attempted_after_stop');
  assert.equal(JSON.stringify(result).includes('TEST_SECRET'),false);
});

test('X import requires declared complete window, deduplicates original authors/text and never invents bot scores',()=>{
  const manifest={provider:'x-official-api-export',repository:'owner/repo',query:'url:github.com/owner/repo',
    startTime:'2026-10-01T00:00:00Z',endTime:'2026-11-02T00:00:00Z',nextTokenExhausted:true,queryCoverageComplete:true};
  const p={created_at:'2026-10-15T00:00:00Z',text:'Useful project https://github.com/owner/repo',author_id:'alice'};
  const data={data:[{...p,id:'1'},{...p,id:'2',author_id:'bob'},{...p,id:'3',text:'RT @alice: useful project https://github.com/owner/repo',referenced_tweets:[{type:'retweeted',id:'1'}]},
    {...p,id:'4',author_id:'carol',text:'My own original tutorial https://github.com/owner/repo'}],meta:{}};
  const result=importX(data,manifest,Date.parse('2026-11-03'));
  assert.equal(result.xUniqueAuthors30d,2);assert.equal(result.excluded.duplicateText,1);assert.equal(result.excluded.retweet,1);
  assert.equal(result.xWindowComplete,true);assert.match(result.botDetection,/not_performed/);
  assert.equal(JSON.stringify(result).includes('alice'),false);
  assert.equal(importX(data,{...manifest,nextTokenExhausted:false},Date.parse('2026-11-03')).xUniqueAuthors30d,null);
  assert.equal(importX({...data,meta:{next_token:'MORE'}},manifest,Date.parse('2026-11-03')).xWindowComplete,false);
  assert.equal(importX(data,{...manifest,startTime:'2026-10-15'},Date.parse('2026-11-03')).xWindowComplete,false);
});
