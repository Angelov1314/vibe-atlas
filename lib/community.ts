import { communityFromHistogram, riskWeight, arenaElo, POLICY_VERSION } from './ranking';

export interface D1Result<T = Record<string, unknown>> { results?: T[]; success?: boolean; meta?: { changes?: number }; }
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
export interface Database {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<D1Result[]>;
}
export interface TrustedIdentity { subject: string; provider: string; verified: true; }
export interface CommunityConfig {
  db: Database;
  /** Only a server-verified session / platform identity; never request body or arbitrary header. */
  identity: TrustedIdentity | null;
  origin: string;
  identityHmacSecret: string;
  validItemIds: ReadonlySet<string>;
  turnstileSecret?: string;
  turnstileSiteKey?: string;
  challengeMode?: 'adaptive' | 'required';
  adminSubject?: string;
  now?: () => number;
  fetcher?: typeof fetch;
  /** Optional evidence from server analytics; no client-supplied risk fields accepted. */
  loadCampaignSignals?: (identityId: string) => Promise<{rapidRepeatedSequence?: boolean; campaignCorrelation?: number}>;
}
type IdentityRow = {id: string; first_seen_at: number; verified_usage_count: number; state: string};
const json = (body: unknown, status = 200, headers: Record<string,string> = {}) => new Response(JSON.stringify(body), {
  status, headers: {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store', ...headers},
});
const current = (c: CommunityConfig) => c.now?.() ?? Date.now();
const bad = (message: string, code: string, status = 400) => json({ok:false,error:code,message},status);

export async function identityKey(c: Pick<CommunityConfig,'identity'|'identityHmacSecret'>) {
  if (!c.identity?.verified || !c.identity.subject || c.identity.subject.length > 1024) throw new Error('authentication_required');
  if (!c.identityHmacSecret || c.identityHmacSecret.length < 32) throw new Error('identity_secret_not_configured');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(c.identityHmacSecret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC',key,encoder.encode(`${c.identity.provider}\u0000${c.identity.subject}`));
  return [...new Uint8Array(signature)].map(n=>n.toString(16).padStart(2,'0')).join('');
}

export async function ensureIdentity(c: CommunityConfig): Promise<IdentityRow> {
  const id = await identityKey(c);
  await c.db.prepare('INSERT INTO identities(id,provider,first_seen_at) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING')
    .bind(id,c.identity!.provider,current(c)).run();
  const row = await c.db.prepare('SELECT id,first_seen_at,verified_usage_count,state FROM identities WHERE id=?').bind(id).first<IdentityRow>();
  if (!row) throw new Error('identity_persistence_failed');
  return row;
}

async function bodyOf(request: Request, c: CommunityConfig): Promise<Record<string,unknown> | Response> {
  if (request.method !== 'POST') return bad('只允许 POST 请求。','method_not_allowed',405);
  if (!c.identity?.verified) return bad('登录后才能提交社区评价。','authentication_required',401);
  if (request.headers.get('origin') !== new URL(c.origin).origin) return bad('请求来源不匹配。','origin_mismatch',403);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return bad('请提交 JSON。','invalid_content_type',415);
  const declaredLength = Number(request.headers.get('content-length'));
  if (declaredLength > 8192) return bad('请求过大。','body_too_large',413);
  const reader=request.body?.getReader();
  if(!reader)return bad('请求不能为空。','invalid_body');
  let size=0,text='';const decoder=new TextDecoder('utf-8',{fatal:true});
  try {
    while(true){
      const chunk=await reader.read();if(chunk.done)break;
      size+=chunk.value.byteLength;
      if(size>8192){await reader.cancel();return bad('请求过大。','body_too_large',413);}
      text+=decoder.decode(chunk.value,{stream:true});
    }
    text+=decoder.decode();
  } catch {return bad('请求编码不正确。','invalid_encoding');}
  finally {reader.releaseLock();}
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return bad('请求格式不正确。','invalid_body');
    return value;
  } catch { return bad('JSON 无法解析。','invalid_json'); }
}

/** Counters are SQL increments, never read-modify-write in JavaScript. */
async function consumeRate(c: CommunityConfig, userId: string, scope: string, minuteLimit = 6, dayLimit = 40) {
  const now = current(c);
  const minute = Math.floor(now/60000), day = Math.floor(now/86400000);
  const statement = (key: string, expires: number) => c.db.prepare(
    'INSERT INTO rate_buckets(bucket_key,hits,expires_at) VALUES(?,1,?) ON CONFLICT(bucket_key) DO UPDATE SET hits=hits+1 RETURNING hits')
    .bind(key,expires);
  const results = await c.db.batch([
    statement(`${scope}:m:${userId}:${minute}`,(minute+1)*60000),
    statement(`${scope}:d:${userId}:${day}`,(day+1)*86400000),
  ]);
  const minuteHits = Number(results[0]?.results?.[0]?.hits ?? 0);
  const dayHits = Number(results[1]?.results?.[0]?.hits ?? 0);
  if (!minuteHits || !dayHits) throw new Error('rate_limit_persistence_failed');
  const blocked = minuteHits > minuteLimit || dayHits > dayLimit;
  const retryAfter = dayHits > dayLimit ? Math.ceil(((day+1)*86400000-now)/1000) : Math.ceil(((minute+1)*60000-now)/1000);
  return {minuteHits,dayHits,blocked,retryAfter};
}

export async function verifyTurnstile(token: unknown, c: CommunityConfig, action: string): Promise<boolean> {
  if (!c.turnstileSecret || typeof token !== 'string' || token.length === 0 || token.length > 2048) return false;
  try {
    const response = await (c.fetcher ?? fetch)('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({secret:c.turnstileSecret,response:token}),
      signal:AbortSignal.timeout(8000),
    });
    if (!response.ok) return false;
    const result = await response.json() as {success?: boolean;hostname?: string;action?: string};
    return result.success === true && result.hostname === new URL(c.origin).hostname && result.action === action;
  } catch { return false; }
}

async function votingRisk(c: CommunityConfig, user: IdentityRow, body: Record<string,unknown>, scope: string) {
  if (user.state === 'suspended') return bad('账号正在审核，可联系站点管理员申诉。','account_under_review',403);
  const rate = await consumeRate(c,user.id,scope);
  if (rate.blocked) return json({ok:false,error:'rate_limited',message:'评价提交过于频繁，请稍后再试。',retryAfter:rate.retryAfter},429,{'Retry-After':String(rate.retryAfter)});
  const campaign = await c.loadCampaignSignals?.(user.id) ?? {};
  const signals = {accountAgeDays:Math.max(0,(current(c)-user.first_seen_at)/86400000),
    verifiedUsageCount:user.verified_usage_count,requestsLastMinute:rate.minuteHits,
    requestsLastDay:rate.dayHits,...campaign,honeypotTriggered:typeof body.website === 'string' && body.website.length>0};
  let risk = riskWeight(signals);
  const needsChallenge = (c.challengeMode ?? 'adaptive') === 'required' || risk.decision === 'challenge';
  if (needsChallenge && !c.turnstileSecret) return bad('本次操作需要人机验证，但站点尚未配置验证服务；评价未计入。','challenge_unavailable',503);
  if (needsChallenge) {
    if (!body.challengeToken) return json({ok:false,error:'challenge_required',siteKey:c.turnstileSiteKey ?? null,action:scope,
      message:'请先完成人机验证，再提交本次评价。'},403);
    const passed = await verifyTurnstile(body.challengeToken,c,scope);
    risk = riskWeight({...signals,challengePassed:passed,challengeFailed:!passed});
  }
  return risk;
}

async function audit(c: CommunityConfig, identity: string, item: string, action: string,
  risk: {risk:number;weight:number;reasons:string[]}) {
  return c.db.prepare('INSERT INTO vote_audit(id,identity_id,item_id,action,risk,weight,reason_codes,policy_version,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),identity,item,action,risk.risk,risk.weight,JSON.stringify(risk.reasons),POLICY_VERSION,current(c));
}

export async function readCommunityScore(db: Database, itemId: string) {
  const aggregate = await db.prepare(
    "SELECT rating,COUNT(*) AS n,SUM(weight) AS sw,SUM(weight*weight) AS sw2 FROM project_votes WHERE item_id=? AND status='accepted' AND weight>0 GROUP BY rating")
    .bind(itemId).all<{rating:number;n:number;sw:number;sw2:number}>();
  const bins=[0,0,0,0,0]; let n=0,sw2=0;
  for(const row of aggregate.results ?? []) {bins[row.rating-1]=row.sw;n+=row.n;sw2+=row.sw2;}
  return communityFromHistogram(bins,sw2,n);
}

export async function submitProjectVote(request: Request,c: CommunityConfig): Promise<Response> {
  const body=await bodyOf(request,c);if(body instanceof Response)return body;
  if(typeof body.itemId!=='string'||!c.validItemIds.has(body.itemId))return bad('项目不存在。','unknown_project',404);
  if(!Number.isInteger(body.rating)||Number(body.rating)<1||Number(body.rating)>5)return bad('评分须为 1–5 的整数。','invalid_rating');
  const user=await ensureIdentity(c),risk=await votingRisk(c,user,body,'project_vote');
  if(risk instanceof Response)return risk;
  if(risk.decision==='reject') {
    await(await audit(c,user.id,body.itemId,'rejected',risk)).run();
    return bad('本次评价未通过完整性检查。','integrity_check_failed',403);
  }
  const status=risk.decision==='quarantine'?'quarantined':'accepted',now=current(c);
  await c.db.batch([
    c.db.prepare('INSERT INTO project_votes(item_id,identity_id,rating,weight,risk,status,reason_codes,policy_version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(item_id,identity_id) DO UPDATE SET rating=excluded.rating,weight=excluded.weight,risk=excluded.risk,status=excluded.status,reason_codes=excluded.reason_codes,policy_version=excluded.policy_version,updated_at=excluded.updated_at')
      .bind(body.itemId,user.id,body.rating,risk.weight,risk.risk,status,JSON.stringify(risk.reasons),POLICY_VERSION,now,now),
    await audit(c,user.id,body.itemId,status,risk),
  ]);
  return json({ok:true,status,weight:risk.weight,risk:risk.risk,reasons:risk.reasons,
    message:status==='quarantined'?'评价已保存，审核后决定是否计分。':'评价已保存；再次评分会更新原有评价。',
    summary:await readCommunityScore(c.db,body.itemId),policyVersion:POLICY_VERSION});
}

export async function getCommunityStatus(c: CommunityConfig,itemId?: string): Promise<Response> {
  const capabilities={persistentVotes:true,uniqueVotePerIdentity:true,atomicRateLimits:true,
    challengeConfigured:Boolean(c.turnstileSecret && c.turnstileSiteKey),challengeMode:c.challengeMode??'adaptive',
    campaignAnalysisConfigured:Boolean(c.loadCampaignSignals),adminReviewConfigured:Boolean(c.adminSubject),
    policyVersion:POLICY_VERSION};
  if(!c.identity?.verified)return json({authenticated:false,capabilities,
    summary:itemId?await readCommunityScore(c.db,itemId):null});
  const user=await ensureIdentity(c);
  const myVote=itemId?await c.db.prepare('SELECT rating,weight,risk,status,reason_codes,updated_at FROM project_votes WHERE identity_id=? AND item_id=?').bind(user.id,itemId).first():null;
  return json({authenticated:true,accountAgeDays:Math.floor((current(c)-user.first_seen_at)/86400000),
    state:user.state,myVote,capabilities,summary:itemId?await readCommunityScore(c.db,itemId):null});
}

export async function submitAppeal(request: Request,c: CommunityConfig): Promise<Response> {
  const body=await bodyOf(request,c);if(body instanceof Response)return body;
  if(typeof body.itemId!=='string'||typeof body.explanation!=='string'||body.explanation.trim().length<20||body.explanation.length>2000)
    return bad('请提供项目及 20–2000 字的申诉说明。','invalid_appeal');
  const user=await ensureIdentity(c);
  const rate=await consumeRate(c,user.id,'appeal',2,6);
  if(rate.blocked)return bad('申诉提交过于频繁，请稍后重试。','rate_limited',429);
  const vote=await c.db.prepare('SELECT status FROM project_votes WHERE identity_id=? AND item_id=?').bind(user.id,body.itemId).first();
  if(!vote)return bad('未找到本账号对该项目的评价。','vote_not_found',404);
  const existing=await c.db.prepare("SELECT id,status,created_at FROM risk_appeals WHERE identity_id=? AND item_id=? AND status='open'").bind(user.id,body.itemId).first();
  if(existing)return json({ok:true,appeal:existing,message:'这项申诉已在等待审核。'});
  const id=crypto.randomUUID();
  try {
    await c.db.prepare('INSERT INTO risk_appeals(id,identity_id,item_id,explanation,created_at) VALUES(?,?,?,?,?)')
      .bind(id,user.id,body.itemId,body.explanation.trim(),current(c)).run();
  } catch(error) {
    if(String(error).includes('UNIQUE'))return bad('这项申诉已在等待审核。','appeal_already_open',409);
    throw error;
  }
  return json({ok:true,appeal:{id,status:'open'},message:'申诉已保存，等待管理员审核。'});
}

/** Creates a blinded comparison only from two moderator-verified, consented outputs. */
export async function createArenaAssignment(c: CommunityConfig,protocolHash: string): Promise<Response> {
  if(!c.identity?.verified)return bad('登录后可参加盲评。','authentication_required',401);
  const user=await ensureIdentity(c);
  const rate=await consumeRate(c,user.id,'arena_assign',10,100);
  if(rate.blocked)return bad('请求过于频繁，请稍后重试。','rate_limited',429);
  const pairs=await c.db.prepare(`SELECT a.id AS a_id,b.id AS b_id,a.prompt_hash,a.model_id AS a_model,b.model_id AS b_model
    FROM arena_samples a JOIN arena_samples b ON a.protocol_hash=b.protocol_hash AND a.prompt_hash=b.prompt_hash AND a.id<b.id
    WHERE a.protocol_hash=? AND a.submitted_by!=? AND b.submitted_by!=? AND a.model_id!=b.model_id AND a.provenance_status='verified' AND b.provenance_status='verified'
    AND a.consent_to_publish=1 AND b.consent_to_publish=1
    AND NOT EXISTS(SELECT 1 FROM arena_votes v WHERE v.identity_id=? AND v.protocol_hash=a.protocol_hash AND v.prompt_hash=a.prompt_hash
      AND v.model_pair_key=CASE WHEN a.model_id<b.model_id THEN a.model_id||'|'||b.model_id ELSE b.model_id||'|'||a.model_id END)
    ORDER BY RANDOM() LIMIT 1`).bind(protocolHash,user.id,user.id,user.id).first<{a_id:string;b_id:string;prompt_hash:string;a_model:string;b_model:string}>();
  if(!pairs)return json({ok:true,status:'awaiting_verified_samples',assignment:null,
    message:'还没有你可以参与的真实可比样本。提交样本经审核后即可开启盲评。'});
  const swap=crypto.getRandomValues(new Uint8Array(1))[0]%2===1;
  const id=crypto.randomUUID(),now=current(c);
  await c.db.prepare('INSERT INTO arena_assignments(id,identity_id,sample_a,sample_b,protocol_hash,prompt_hash,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .bind(id,user.id,swap?pairs.b_id:pairs.a_id,swap?pairs.a_id:pairs.b_id,protocolHash,pairs.prompt_hash,now+1800000,now).run();
  return json({ok:true,status:'ready',assignment:{id,protocolHash,expiresAt:now+1800000,
    outputA:`/api/arena/media/${id}/a`,outputB:`/api/arena/media/${id}/b`}});
}

/** Server-only lookup for an authenticated proxy. Do not expose object keys/model IDs before voting. */
export async function getArenaMedia(c: CommunityConfig,assignmentId: string,side:'a'|'b') {
  if(!c.identity?.verified)return null;
  const identity=await identityKey(c);
  return c.db.prepare(`SELECT s.object_key,s.media_type,s.byte_size FROM arena_assignments x
    JOIN arena_samples s ON s.id=${side==='a'?'x.sample_a':'x.sample_b'}
    WHERE x.id=? AND x.identity_id=? AND x.expires_at>? AND s.provenance_status='verified' AND s.consent_to_publish=1`)
    .bind(assignmentId,identity,current(c)).first<{object_key:string;media_type:string;byte_size:number}>();
}

/** Rechecks current moderation status so a revoked sample's old votes stop counting. */
export async function readArenaLeaderboard(db:Database,protocolHash:string) {
  const protocol=await db.prepare('SELECT hash,modality,definition_json FROM arena_protocols WHERE hash=?')
    .bind(protocolHash).first<{hash:string;modality:string;definition_json:string}>();
  if(!protocol)return {protocol:null,status:'awaiting_verified_protocol',models:[],totalBattles:0};
  const result=await db.prepare(`SELECT v.assignment_id AS id,v.winner,v.weight,v.created_at,
    a.model_id AS model_a,b.model_id AS model_b,a.output_sha256 AS output_a,b.output_sha256 AS output_b
    FROM arena_votes v JOIN arena_assignments x ON x.id=v.assignment_id
    JOIN arena_samples a ON a.id=x.sample_a JOIN arena_samples b ON b.id=x.sample_b
    WHERE v.protocol_hash=? AND v.status='accepted' AND v.weight>0 AND v.winner IN ('a','b','tie')
    AND a.provenance_status='verified' AND b.provenance_status='verified' AND a.consent_to_publish=1 AND b.consent_to_publish=1
    AND a.protocol_hash=v.protocol_hash AND b.protocol_hash=v.protocol_hash AND a.prompt_hash=v.prompt_hash AND b.prompt_hash=v.prompt_hash
    AND a.model_id!=b.model_id AND a.submitted_by!=v.identity_id AND b.submitted_by!=v.identity_id
    ORDER BY v.created_at,v.assignment_id`).bind(protocolHash)
    .all<{id:string;winner:'a'|'b'|'tie';weight:number;created_at:number;model_a:string;model_b:string;output_a:string;output_b:string}>();
  return {protocol,...arenaElo((result.results??[]).map(row=>({id:row.id,modelA:row.model_a,modelB:row.model_b,
    winner:row.winner,weight:row.weight,modality:protocol.modality,protocolHash,outputAHash:row.output_a,
    outputBHash:row.output_b,blinded:true,ratedAt:new Date(row.created_at).toISOString()})),protocol.modality,protocolHash)};
}

export async function submitArenaVote(request:Request,c:CommunityConfig):Promise<Response> {
  const body=await bodyOf(request,c);if(body instanceof Response)return body;
  if(typeof body.assignmentId!=='string'||!['a','b','tie','both_bad'].includes(String(body.winner)))return bad('盲评选择无效。','invalid_arena_vote');
  const user=await ensureIdentity(c),risk=await votingRisk(c,user,body,'arena_vote');
  if(risk instanceof Response)return risk;
  if(risk.decision==='reject')return bad('本次盲评未通过完整性检查。','integrity_check_failed',403);
  const row=await c.db.prepare(`SELECT x.*,a.model_id AS model_a,b.model_id AS model_b,a.model_revision AS revision_a,b.model_revision AS revision_b,
    a.provenance_status AS a_status,b.provenance_status AS b_status,a.consent_to_publish AS a_consent,b.consent_to_publish AS b_consent,
    a.protocol_hash AS a_protocol,b.protocol_hash AS b_protocol,a.prompt_hash AS a_prompt,b.prompt_hash AS b_prompt,
    a.submitted_by AS a_submitter,b.submitted_by AS b_submitter
    FROM arena_assignments x JOIN arena_samples a ON a.id=x.sample_a JOIN arena_samples b ON b.id=x.sample_b
    WHERE x.id=? AND x.identity_id=?`).bind(body.assignmentId,user.id).first<Record<string,unknown>>();
  if(!row)return bad('未找到本账号的盲评任务。','assignment_not_found',404);
  if(row.revealed_at||Number(row.expires_at)<=current(c))return bad('盲评已结束、已揭盲或已过期。','assignment_closed',409);
  if(row.a_submitter===user.id||row.b_submitter===user.id)return bad('上传者不能评价自己提供的样本。','self_vote_not_allowed',409);
  if(row.a_status!=='verified'||row.b_status!=='verified'||!row.a_consent||!row.b_consent||row.model_a===row.model_b||row.a_protocol!==row.b_protocol||row.a_protocol!==row.protocol_hash||row.a_prompt!==row.b_prompt||row.a_prompt!==row.prompt_hash)
    return bad('样本不满足同协议比较要求。','incomparable_samples',409);
  const pair=[String(row.model_a),String(row.model_b)].sort().join('|'),status=risk.decision==='quarantine'?'quarantined':'accepted',now=current(c);
  try {
    const results=await c.db.batch([
      c.db.prepare(`INSERT INTO arena_votes(assignment_id,identity_id,winner,protocol_hash,prompt_hash,model_pair_key,weight,status,policy_version,created_at)
        SELECT x.id,x.identity_id,?,x.protocol_hash,x.prompt_hash,?,?,?,?,? FROM arena_assignments x
        JOIN arena_samples a ON a.id=x.sample_a JOIN arena_samples b ON b.id=x.sample_b
        WHERE x.id=? AND x.identity_id=? AND x.revealed_at IS NULL AND x.expires_at>?
        AND a.provenance_status='verified' AND b.provenance_status='verified' AND a.consent_to_publish=1 AND b.consent_to_publish=1
        AND a.protocol_hash=x.protocol_hash AND b.protocol_hash=x.protocol_hash AND a.prompt_hash=x.prompt_hash AND b.prompt_hash=x.prompt_hash
        AND a.model_id!=b.model_id AND a.submitted_by!=x.identity_id AND b.submitted_by!=x.identity_id`)
        .bind(body.winner,pair,risk.weight,status,POLICY_VERSION,now,body.assignmentId,user.id,now),
      c.db.prepare('UPDATE arena_assignments SET revealed_at=? WHERE id=? AND identity_id=? AND EXISTS(SELECT 1 FROM arena_votes WHERE assignment_id=?)')
        .bind(now,body.assignmentId,user.id,body.assignmentId),
      await audit(c,user.id,`arena:${body.assignmentId}`,status,risk),
    ]);
    if(!results[0]?.meta?.changes)return bad('盲评状态已改变，本次未计票。','assignment_closed',409);
  } catch(error) {
    if(String(error).includes('UNIQUE'))return bad('这组模型和提示词你已经评价过了。','duplicate_evidence',409);
    throw error;
  }
  return json({ok:true,status,weight:risk.weight,models:{a:row.model_a,b:row.model_b},
    revisions:{a:row.revision_a,b:row.revision_b},message:'偏好已保存，模型身份现已揭晓。'});
}

export async function reviewArenaSamples(request:Request,c:CommunityConfig):Promise<Response> {
  const body=await bodyOf(request,c);if(body instanceof Response)return body;
  if(!c.adminSubject)return bad('尚未配置样本审核管理员。','admin_not_configured',503);
  if(c.identity!.subject!==c.adminSubject)return bad('仅管理员可审核样本。','admin_required',403);
  if(!Array.isArray(body.sampleIds)||body.sampleIds.length<1||body.sampleIds.length>20||body.sampleIds.some(x=>typeof x!=='string')
    ||!['verified','rejected'].includes(String(body.decision)))return bad('审核参数无效。','invalid_review');
  const user=await ensureIdentity(c);
  const statements: D1Statement[]=[];
  for(const id of body.sampleIds as string[]) {
    statements.push(c.db.prepare('UPDATE arena_samples SET provenance_status=? WHERE id=?').bind(body.decision,id));
    statements.push(await audit(c,user.id,`sample:${id}`,`review_${body.decision}`,{risk:0,weight:0,reasons:['administrator_review']}));
  }
  await c.db.batch(statements);
  return json({ok:true,decision:body.decision,sampleIds:body.sampleIds});
}

export async function resolveAppeal(request:Request,c:CommunityConfig):Promise<Response> {
  const body=await bodyOf(request,c);if(body instanceof Response)return body;
  if(!c.adminSubject)return bad('尚未配置申诉审核管理员。','admin_not_configured',503);
  if(c.identity!.subject!==c.adminSubject)return bad('仅管理员可处理申诉。','admin_required',403);
  if(typeof body.appealId!=='string'||!['restore','reject'].includes(String(body.decision))||typeof body.resolution!=='string'||body.resolution.length<5||body.resolution.length>2000)
    return bad('请提供申诉编号、审核决定和说明。','invalid_resolution');
  const appeal=await c.db.prepare("SELECT a.*,i.first_seen_at,i.verified_usage_count FROM risk_appeals a JOIN identities i ON i.id=a.identity_id WHERE a.id=? AND a.status='open'")
    .bind(body.appealId).first<{identity_id:string;item_id:string;first_seen_at:number;verified_usage_count:number}>();
  if(!appeal)return bad('未找到待处理申诉。','appeal_not_found',404);
  const now=current(c),restored=riskWeight({accountAgeDays:(now-appeal.first_seen_at)/86400000,
    verifiedUsageCount:appeal.verified_usage_count,requestsLastMinute:0,requestsLastDay:0});
  const statements=[c.db.prepare('UPDATE risk_appeals SET status=?,resolution=?,resolved_at=? WHERE id=? AND status=\'open\'')
    .bind(body.decision==='restore'?'resolved':'rejected',body.resolution,now,body.appealId)];
  if(body.decision==='restore')statements.push(c.db.prepare("UPDATE project_votes SET weight=?,risk=0,status='accepted',reason_codes='[\"appeal_restored\"]',policy_version=?,updated_at=? WHERE identity_id=? AND item_id=?")
    .bind(restored.weight,POLICY_VERSION,now,appeal.identity_id,appeal.item_id));
  statements.push(await audit(c,appeal.identity_id,appeal.item_id,`appeal_${body.decision}`,
    {risk:0,weight:body.decision==='restore'?restored.weight:0,reasons:['administrator_review']}));
  await c.db.batch(statements);
  return json({ok:true,decision:body.decision});
}
