import {createArenaAssignment, identityKey, readArenaLeaderboard, submitArenaVote} from '../../../lib/community';
import {getCommunityConfig} from '../../../lib/server';
import {modalities} from '../../../lib/catalog';

const response = (value: unknown, status = 200) => Response.json(value, {status, headers:{'Cache-Control':'no-store'}});
const supported = new Set(modalities.filter(m => ['图像','视频','三维','音频','语音'].includes(m.group) && !['speech-recognition','audio-understanding'].includes(m.id)).map(m => m.id));

export async function GET(request: Request) {
  try {
    const c = await getCommunityConfig(request);
    const url = new URL(request.url), modality = url.searchParams.get('modality') || 'text-to-image';
    if (!supported.has(modality)) return response({ok:false,message:'该任务暂不使用媒体盲评；可在模型目录查看候选。'},400);
    const rows = await c.db.prepare(`SELECT p.hash,p.modality,p.definition_json,
      COUNT(s.id) AS sample_count,
      SUM(CASE WHEN s.provenance_status='verified' AND s.consent_to_publish=1 THEN 1 ELSE 0 END) AS verified_count,
      SUM(CASE WHEN s.provenance_status='pending' THEN 1 ELSE 0 END) AS pending_count
      FROM arena_protocols p LEFT JOIN arena_samples s ON s.protocol_hash=p.hash
      WHERE p.modality=? GROUP BY p.hash ORDER BY p.created_at DESC LIMIT 100`).bind(modality)
      .all<{hash:string;modality:string;definition_json:string;sample_count:number;verified_count:number;pending_count:number}>();
    const protocols = (rows.results || []).map(row => {
      let definition: Record<string,unknown> = {};
      try { definition = JSON.parse(row.definition_json); } catch { /* Invalid legacy definitions remain empty. */ }
      return {hash:row.hash,modality:row.modality,definition,sampleCount:row.sample_count,
        verifiedSamples:Number(row.verified_count || 0),pendingSamples:Number(row.pending_count || 0)};
    });
    const requested = url.searchParams.get('protocol');
    const selected = protocols.find(p => p.hash === requested) || protocols.find(p => p.verifiedSamples >= 2) || protocols[0];
    const leaderboard = selected ? await readArenaLeaderboard(c.db,selected.hash) : {status:'awaiting-real-blind-comparisons',models:[],totalBattles:0};
    return response({ok:true,modality,protocols,selectedProtocol:selected?.hash || null,leaderboard,
      authenticated:Boolean(c.identity?.verified),isAdmin:Boolean(c.adminSubject && c.identity?.verified && c.identity.subject === c.adminSubject),
      capabilities:{storage:'durable',adminReviewConfigured:Boolean(c.adminSubject),challengeConfigured:Boolean(c.turnstileSecret && c.turnstileSiteKey)},
      sourcePolicy:'只有经管理员核验、授权公开且遵循同一协议的真实样本可以进入盲评。'});
  } catch { return response({ok:false,error:'arena_unavailable',message:'盲评服务暂时不可用，请稍后重试。'},503); }
}

export async function POST(request: Request) {
  try {
    const c = await getCommunityConfig(request);
    if (!c.identity?.verified) return response({ok:false,error:'authentication_required',message:'登录后可参加真实盲评。'},401);
    if (request.headers.get('origin') !== new URL(c.origin).origin) return response({ok:false,message:'请求来源不匹配。'},403);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return response({ok:false,message:'需要 JSON 请求。'},415);
    if (Number(request.headers.get('content-length')) > 8192) return response({ok:false,message:'请求过大。'},413);
    if (!request.body) return response({ok:false,message:'请求为空。'},400);
    const reader=request.body.getReader(),chunks:Uint8Array[]=[];let byteLength=0;
    for(;;){const {done,value}=await reader.read();if(done)break;byteLength+=value.byteLength;
      if(byteLength>8192){await reader.cancel();return response({ok:false,message:'请求过大。'},413);}chunks.push(value);}
    const raw=await new Blob(chunks.map(chunk=>new Uint8Array(chunk).buffer)).text();
    let body:Record<string,unknown>;try{body=JSON.parse(raw);}catch{return response({ok:false,message:'JSON 无法解析。'},400);}
    if (!body || typeof body!=='object' || Array.isArray(body)) return response({ok:false,message:'请求格式无效。'},400);
    if (body.action === 'vote') return submitArenaVote(new Request(request.url,{method:'POST',headers:request.headers,body:raw}),c);
    if (body.action !== 'assign' || typeof body.protocolHash !== 'string' || !/^[a-f0-9]{64}$/.test(body.protocolHash))
      return response({ok:false,message:'请选择一个已存在的评测协议。'},400);
    const protocol = await c.db.prepare('SELECT modality,definition_json FROM arena_protocols WHERE hash=?').bind(body.protocolHash)
      .first<{modality:string;definition_json:string}>();
    if (!protocol || !supported.has(protocol.modality)) return response({ok:false,message:'评测协议不存在。'},404);
    const assignmentResponse = await createArenaAssignment(c,body.protocolHash);
    const result = await assignmentResponse.json() as {ok:boolean;assignment?:{id:string};[key:string]:unknown};
    if (!result.assignment) return response(result,assignmentResponse.status);
    const userId = await identityKey(c);
    const pair = await c.db.prepare(`SELECT a.parameters_json AS params_a,b.parameters_json AS params_b FROM arena_assignments x
      JOIN arena_samples a ON a.id=x.sample_a JOIN arena_samples b ON b.id=x.sample_b
      WHERE x.id=? AND x.identity_id=?`).bind(result.assignment.id,userId).first<{params_a:string;params_b:string}>();
    if (!pair) return response({ok:false,message:'无法读取盲评任务，请重试。'},409);
    const a = JSON.parse(pair.params_a), b = JSON.parse(pair.params_b);
    if (typeof a.prompt !== 'string' || a.prompt !== b.prompt || a.inputSha256 !== b.inputSha256)
      return response({ok:false,message:'样本的提示词或输入证据不一致，暂不参与比较。'},409);
    return response({...result,assignment:{...result.assignment,prompt:a.prompt,inputSha256:a.inputSha256 || null,
      modality:protocol.modality,protocol:JSON.parse(protocol.definition_json)}});
  } catch { return response({ok:false,error:'arena_unavailable',message:'未能完成这次操作，请稍后重试。'},503); }
}
