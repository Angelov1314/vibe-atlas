#!/usr/bin/env node
/** Public-source snapshots only. Never edits the curated catalog or computes an invented X score. */
import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as http from 'node:http';

export const SNAPSHOT_VERSION=1;
const DAY=86400000;
const isNumber=n=>typeof n==='number'&&Number.isFinite(n);
const nowISO=()=>new Date().toISOString();

export function repositorySlug(value){
  if(typeof value!=='string')return null;
  let candidate=value.trim();
  if(candidate.startsWith('https://')||candidate.startsWith('http://')){
    try{const url=new URL(candidate);if(url.hostname.toLowerCase()!=='github.com')return null;
      candidate=url.pathname.replace(/^\//,'').split('/').slice(0,2).join('/');}catch{return null;}
  }
  candidate=candidate.replace(/\.git$/,'').replace(/\/$/,'');
  return /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9_.-]+$/.test(candidate)?candidate:null;
}

export function uniqueRepositories(documents){
  const found=new Map();
  for(const doc of documents)for(const item of [...(doc.projects??[]),...(doc.models??[])]){
    const repo=repositorySlug(item.repo??item.github);
    if(!repo)continue;
    const key=repo.toLowerCase(),existing=found.get(key);
    if(existing){if(item.id&&!existing.itemIds.includes(item.id))existing.itemIds.push(item.id);}
    else found.set(key,{repo,itemIds:item.id?[item.id]:[]});
  }
  return [...found.values()].sort((a,b)=>a.repo.localeCompare(b.repo));
}

export function prioritizeRepositories(repositories,history){
  const latest=[...history].sort((a,b)=>Date.parse(b.collectedAt)-Date.parse(a.collectedAt))[0];
  if(!latest?.repositories)return repositories;
  const previous=new Map(Object.entries(latest.repositories).map(([k,v])=>[k.toLowerCase(),v]));
  return [...repositories].sort((a,b)=>{
    const aa=previous.get(a.repo.toLowerCase()),bb=previous.get(b.repo.toLowerCase());
    const missingA=aa?.ok?1:0,missingB=bb?.ok?1:0;
    return missingA-missingB||(Date.parse(aa?.observedAt??'1970-01-01')-Date.parse(bb?.observedAt??'1970-01-01'));
  });
}

/** A real comparison window must be at least 30 days; no backfilled/fabricated starting point. */
export function measuredGrowth(current,history){
  const currentAt=Date.parse(current.observedAt),canonical=(current.fullName??current.repo??'').toLowerCase();
  if(!current.ok||!isNumber(current.stars)||!Number.isFinite(currentAt))return {starsGained30d:null,reason:'current_observation_missing'};
  const candidates=[];
  for(const snapshot of history)for(const [key,record] of Object.entries(snapshot.repositories??{})){
    if(!record.ok||!isNumber(record.stars))continue;
    if((record.fullName??key).toLowerCase()!==canonical)continue;
    const timestamp=Date.parse(record.observedAt??snapshot.collectedAt),days=(currentAt-timestamp)/DAY;
    // Daily collection rarely occurs at the exact same millisecond. Record the actual 30–31 day window.
    if(Number.isFinite(days)&&days>=30&&days<=31)candidates.push({...record,observedAt:new Date(timestamp).toISOString(),days});
  }
  candidates.sort((a,b)=>a.days-b.days);
  const baseline=candidates[0];
  if(!baseline)return {starsGained30d:null,reason:'no_real_30_to_31_day_baseline'};
  const netChange=current.stars-baseline.stars;
  return {starsGained30d:Math.max(0,netChange),netStarChange:netChange,windowDays:Number(baseline.days.toFixed(5)),
    baselineObservedAt:baseline.observedAt,baselineStars:baseline.stars,
    method:'actual 30–31 day snapshot delta; negative net changes retained separately; no extrapolation'};
}

export async function collectGitHub(repositories,{token=process.env.GITHUB_TOKEN,fetcher=fetch,history=[],onProgress=()=>{}}={}){
  const records={},headers={Accept:'application/vnd.github+json','User-Agent':'VibeAtlas-public-metrics/1.0'};
  if(token)headers.Authorization=`Bearer ${token}`;
  // Intentionally sequential: immediately stop on primary/secondary throttling and do not fan out retries.
  let stoppedReason=null;
  for(let i=0;i<repositories.length;i++){
    const {repo,itemIds}=repositories[i],source=`https://api.github.com/repos/${repo}`;
    if(stoppedReason){records[repo]={ok:false,repo,itemIds,source,observedAt:null,missingReason:'not_attempted_after_stop',stopReason:stoppedReason};continue;}
    try{
      const response=await fetcher(source,{headers,redirect:'follow',signal:AbortSignal.timeout(25000)});
      const observedAt=nowISO();
      let data;try{data=await response.json();}catch{data={};}
      const rateRemaining=response.headers.get('x-ratelimit-remaining'),reset=response.headers.get('x-ratelimit-reset');
      const rate={remaining:rateRemaining===null?null:Number(rateRemaining),resetAt:reset?new Date(Number(reset)*1000).toISOString():null,
        retryAfter:response.headers.get('retry-after')};
      if(response.status===429||(response.status===403&&(rateRemaining==='0'||/rate limit|abuse/i.test(String(data.message??''))))){
        stoppedReason=response.status===429?'github_http_429':'github_rate_limited';
        records[repo]={ok:false,repo,itemIds,source,observedAt,status:response.status,missingReason:stoppedReason,rate};
      }else if(!response.ok){
        records[repo]={ok:false,repo,itemIds,source,observedAt,status:response.status,
          missingReason:response.status===404?'repository_not_found_or_not_public':response.status===403?'public_read_forbidden':`github_http_${response.status}`,rate};
        if(response.status===401)stoppedReason='github_authentication_rejected';
      }else if(!Number.isInteger(data.stargazers_count)||!data.full_name||data.private===true){
        records[repo]={ok:false,repo,itemIds,source,observedAt,missingReason:'unexpected_public_repository_schema'};
      }else{
        const spdx=data.license?.spdx_id;
        const record={ok:true,repo,itemIds,source,observedAt,fullName:data.full_name,url:data.html_url,
          stars:data.stargazers_count,forks:data.forks_count,pushedAt:data.pushed_at,createdAt:data.created_at,
          archived:Boolean(data.archived),disabled:Boolean(data.disabled),isFork:Boolean(data.fork),
          licenseSpdx:spdx&&spdx!=='NOASSERTION'?spdx:null,licenseName:data.license?.name??null,
          licenseSource:data.license?.url??null,licenseNote:spdx==='NOASSERTION'?'GitHub did not assign a standard SPDX license; inspect LICENSE manually.':null,
          homepage:data.homepage??null,defaultBranch:data.default_branch??null,
          apiVersion:response.headers.get('x-github-api-version-selected'),rate,contributors90d:null};
        record.growth=measuredGrowth(record,history);records[repo]=record;
        if(rate.remaining===0)stoppedReason='github_budget_exhausted';
      }
    }catch(error){
      // Do not persist response bodies, request headers, token values, or full thrown objects.
      records[repo]={ok:false,repo,itemIds,source,observedAt:nowISO(),missingReason:'network_or_timeout',errorType:error?.name??'Error'};
      stoppedReason='network_failure';
    }
    onProgress({attempted:i+1,total:repositories.length,succeeded:Object.values(records).filter(r=>r.ok).length,stoppedReason});
  }
  return {repositories:records,stoppedReason};
}

const normalizeText=text=>text.normalize('NFKC').toLowerCase().replace(/https?:\/\/\S+/g,' ')
  .replace(/[\p{P}\p{S}\s]+/gu,' ').trim();
function postLinksRepo(post,slug){
  const urls=(post.entities?.urls??[]).flatMap(u=>[u.expanded_url,u.unwound_url,u.url]).filter(x=>typeof x==='string');
  for(const url of urls)if(repositorySlug(url)?.toLowerCase()===slug)return true;
  const escaped=slug.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp(`https?://(?:www\\.)?github\\.com/${escaped}(?=$|[\\s/#?)])`,'i').test(post.text??'');
}

/** Import, never scrape: completeness is an explicit operator declaration, not independently proved. */
export function importX(exported,manifest,now=Date.now()){
  const problems=[],repo=repositorySlug(manifest?.repository);
  const start=Date.parse(manifest?.startTime),end=Date.parse(manifest?.endTime);
  if(!repo)problems.push('repository_missing');
  if(manifest?.provider!=='x-official-api-export')problems.push('official_api_provenance_not_declared');
  if(typeof manifest?.query!=='string'||!manifest.query.trim())problems.push('query_missing');
  if(!Number.isFinite(start)||!Number.isFinite(end)||end-start<30*DAY)problems.push('full_30_day_window_missing');
  if(Number.isFinite(end)&&end>now+300000)problems.push('future_window_not_allowed');
  if(manifest?.nextTokenExhausted!==true)problems.push('pagination_not_exhausted');
  if(manifest?.queryCoverageComplete!==true)problems.push('query_coverage_not_declared_complete');
  const pages=Array.isArray(exported?.pages)?exported.pages:[Array.isArray(exported)?{data:exported}:exported??{}];
  const lastPage=pages.at(-1);
  if(lastPage?.meta?.next_token)problems.push('last_page_still_has_next_token');
  const allPosts=pages.flatMap(p=>Array.isArray(p.data)?p.data:[]);
  const ids=new Set(),texts=new Set(),authors=new Set(),accepted=[];
  const excluded={duplicateId:0,retweet:0,missingRequiredFields:0,outsideWindow:0,noRepositoryLink:0,duplicateText:0};
  const effectiveStart=end-30*DAY;
  for(const post of allPosts){
    if(!post?.id||!post.author_id||typeof post.text!=='string'||!Number.isFinite(Date.parse(post.created_at))){excluded.missingRequiredFields++;continue;}
    if(ids.has(post.id)){excluded.duplicateId++;continue;}ids.add(post.id);
    if((post.referenced_tweets??[]).some(r=>r.type==='retweeted')||/^RT\s+@/i.test(post.text)){excluded.retweet++;continue;}
    const date=Date.parse(post.created_at);
    if(!Number.isFinite(end)||date<effectiveStart||date>=end){excluded.outsideWindow++;continue;}
    if(!repo||!postLinksRepo(post,repo.toLowerCase())){excluded.noRepositoryLink++;continue;}
    const text=normalizeText(post.text);
    if(!text||texts.has(text)){excluded.duplicateText++;continue;}texts.add(text);
    authors.add(String(post.author_id));accepted.push(String(post.id));
  }
  if(excluded.missingRequiredFields>0)problems.push('required_post_fields_missing');
  const complete=problems.length===0;
  return {repository:repo,source:'operator-supplied official X API export; origin declaration not independently verified',
    query:manifest?.query??null,declaredStartTime:manifest?.startTime??null,declaredEndTime:manifest?.endTime??null,
    measuredStartTime:Number.isFinite(effectiveStart)?new Date(effectiveStart).toISOString():null,
    xWindowComplete:complete,xUniqueAuthors30d:complete?authors.size:null,
    evidenceStatus:complete?'complete-declared-window':'incomplete-no-ranking-signal',problems,
    postsSupplied:allPosts.length,originalLinkedPostsAccepted:accepted.length,excluded,
    privacy:'Snapshot retains only aggregate counts, not author IDs or post text.',
    metricDefinition:'unique authors of original, distinct-text posts linking the exact repository, within the declared 30-day query window',
    botDetection:'not_performed; no invented bot probability or human-identity guarantee',
    limitations:'Covers this declared query and exported corpus only; not all discussion on X or the whole internet.'};
}

async function readJSON(path){
  const info=await stat(path);if(info.size>32*1024*1024)throw new Error(`JSON input exceeds 32MiB: ${basename(path)}`);
  return JSON.parse(await readFile(path,'utf8'));
}
export async function readHistory(directory){
  try{
    const files=(await readdir(directory)).filter(f=>f.endsWith('.json'));
    const snapshots=[];
    for(const file of files){try{const value=await readJSON(resolve(directory,file));if(value.schemaVersion===SNAPSHOT_VERSION&&value.repositories)snapshots.push(value);}catch{/* invalid history file is not a valid baseline */}}
    return snapshots;
  }catch(error){if(error?.code==='ENOENT')return [];throw error;}
}

function argsFrom(argv){
  const args={catalog:'data/catalog.json',models:null,history:'metrics/snapshots',output:null,xImport:null,xManifest:null,offline:false};
  const keys={'--catalog':'catalog','--models':'models','--history':'history','--output':'output','--x-import':'xImport','--x-manifest':'xManifest'};
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];if(arg==='--offline'){args.offline=true;continue;}
    if(arg==='--help'){args.help=true;continue;}
    if(!keys[arg]||!argv[i+1]||argv[i+1].startsWith('--'))throw new Error(`Unknown or incomplete argument: ${arg}`);
    args[keys[arg]]=argv[++i];
  }
  if(Boolean(args.xImport)!==Boolean(args.xManifest))throw new Error('--x-import and --x-manifest must be supplied together');
  return args;
}

export async function main(argv=process.argv.slice(2)){
  const args=argsFrom(argv);
  if(args.help){console.log('node scripts/collect-metrics.mjs [--catalog file] [--models file] [--history dir] [--output file] [--x-import export.json --x-manifest manifest.json] [--offline]');return;}
  if(!args.offline&&(process.env.HTTPS_PROXY||process.env.HTTP_PROXY||process.env.https_proxy||process.env.http_proxy)){
    if(typeof http.setGlobalProxyFromEnv==='function')http.setGlobalProxyFromEnv();
    else if(process.env.NODE_USE_ENV_PROXY!=='1')throw new Error('A proxy is configured. Use Node 24.14+ or start supported Node with NODE_USE_ENV_PROXY=1; direct fallback is disabled.');
  }
  const documents=[await readJSON(resolve(args.catalog))];if(args.models)documents.push(await readJSON(resolve(args.models)));
  const history=await readHistory(resolve(args.history)),repos=prioritizeRepositories(uniqueRepositories(documents),history);
  const collectedAt=nowISO();
  const path=resolve(args.output??`${args.history}/${collectedAt.replace(/[:.]/g,'-')}.json`);
  try{await stat(path);throw Object.assign(new Error('Snapshot output already exists.'),{code:'EEXIST'});}catch(error){if(error?.code!=='ENOENT')throw error;}
  const results=args.offline?{repositories:Object.fromEntries(repos.map(r=>[r.repo,{ok:false,repo:r.repo,itemIds:r.itemIds,missingReason:'offline_mode',observedAt:null}])),stoppedReason:'offline_mode'}:
    await collectGitHub(repos,{history,onProgress:p=>{if(p.attempted%10===0||p.stoppedReason)console.error(JSON.stringify({progress:p}));}});
  const x=args.xImport?importX(await readJSON(resolve(args.xImport)),await readJSON(resolve(args.xManifest))):null;
  const snapshot={schemaVersion:SNAPSHOT_VERSION,collectedAt,completedAt:nowISO(),
    provenance:{github:'GitHub official REST repository endpoint',x:x?.source??'not collected'},
    requestedRepositories:repos.length,...results,x,
    notes:['No community votes or Arena scores are generated by this collector.','Snapshots do not modify curated project metadata.','Repository code licenses do not establish model-weight licenses.']};
  await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});
  const records=Object.values(snapshot.repositories);
  console.log(JSON.stringify({output:path,repositories:repos.length,verified:records.filter(r=>r.ok).length,
    missing:records.filter(r=>!r.ok).length,licenseIdentified:records.filter(r=>r.ok&&r.licenseSpdx).length,
    measuredGrowthWindows:records.filter(r=>r.growth?.starsGained30d!==null&&r.growth?.starsGained30d!==undefined).length,
    stoppedReason:results.stoppedReason,xWindowComplete:x?.xWindowComplete??false}));
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{
  // Error text contains local argument/path/schema information only. Never dump headers/env/token.
  console.error(JSON.stringify({error:error?.code==='EEXIST'?'Output already exists; choose a new snapshot filename.':String(error?.message??'collection_failed')}));
  process.exitCode=1;
});
