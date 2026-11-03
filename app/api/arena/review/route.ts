import {reviewArenaSamples} from '../../../../lib/community';
import {getCommunityConfig,getStorage} from '../../../../lib/server';
import {items} from '../../../../lib/catalog';

const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
const safeTypes=new Set(['image/png','image/jpeg','image/webp','video/mp4','video/webm','audio/wav','audio/mpeg']);

export async function GET(request:Request) {
  try {
    const c=await getCommunityConfig(request);
    if(!c.adminSubject)return json({ok:false,error:'admin_not_configured',message:'尚未配置明确的样本审核管理员。'},503);
    if(!c.identity?.verified || c.identity.subject!==c.adminSubject)return json({ok:false,error:'admin_required',message:'仅指定管理员可访问来源与待审核媒体。'},403);
    const url=new URL(request.url),mediaId=url.searchParams.get('media');
    if(mediaId){
      if(!/^[a-f0-9-]{36}$/.test(mediaId))return json({ok:false,message:'样本编号无效。'},400);
      const row=await c.db.prepare('SELECT object_key,media_type,byte_size FROM arena_samples WHERE id=?').bind(mediaId)
        .first<{object_key:string;media_type:string;byte_size:number}>();
      if(!row || !safeTypes.has(row.media_type))return json({ok:false,message:'媒体不可用。'},404);
      const bucket=await getStorage(),object=bucket?await bucket.get(row.object_key):null;
      if(!object || !('body' in object))return json({ok:false,message:'媒体暂时不可用。'},404);
      return new Response(object.body,{headers:{'Content-Type':row.media_type,'Content-Length':String(row.byte_size),
        'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline',
        'Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; sandbox"}});
    }
    const status=url.searchParams.get('status')==='verified'?'verified':'pending';
    const result=await c.db.prepare(`SELECT id,model_id,model_revision,protocol_hash,prompt_hash,output_sha256,
      media_type,byte_size,parameters_json,provenance_status,created_at FROM arena_samples
      WHERE provenance_status=? ORDER BY created_at DESC LIMIT 30`).bind(status).all<Record<string,unknown>>();
    return json({ok:true,status,samples:(result.results || []).map(row=>{
      let parameters:Record<string,unknown>={};try{parameters=JSON.parse(String(row.parameters_json));}catch{/* legacy data */}
      const {parameters_json:_,...safe}=row;
      return {...safe,parameters,mediaUrl:`/api/arena/review?media=${encodeURIComponent(String(row.id))}`};
    })});
  } catch{return json({ok:false,message:'审核队列暂时不可用。'},503);}
}

export async function POST(request:Request) {
  try {
    const c=await getCommunityConfig(request);
    if(!c.adminSubject)return json({ok:false,error:'admin_not_configured',message:'尚未配置明确的样本审核管理员。'},503);
    if(!c.identity?.verified || c.identity.subject!==c.adminSubject)return json({ok:false,error:'admin_required',message:'仅指定管理员可审核样本。'},403);
    if(request.headers.get('origin')!==new URL(c.origin).origin)return json({ok:false,message:'请求来源不匹配。'},403);
    if(!request.headers.get('content-type')?.startsWith('application/json') || !request.body)return json({ok:false,message:'需要 JSON 请求。'},415);
    const reader=request.body.getReader(),parts:Uint8Array[]=[];let size=0;
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();return json({ok:false,message:'请求过大。'},413);}parts.push(value);}
    const body=JSON.parse(await new Blob(parts.map(part=>new Uint8Array(part).buffer)).text()) as Record<string,unknown>;
    if(!Array.isArray(body.sampleIds) || body.sampleIds.length<1 || body.sampleIds.length>20 || body.sampleIds.some(x=>typeof x!=='string' || !/^[a-f0-9-]{36}$/.test(x))
      || !['verified','rejected'].includes(String(body.decision)))return json({ok:false,message:'审核参数无效。'},400);
    if(body.confirmed!==true || typeof body.notes!=='string' || body.notes.trim().length<20 || body.notes.length>1500)
      return json({ok:false,message:'请记录至少 20 字的核验依据，并确认已核对来源、版本、输入和参数。'},400);
    const bucket=await getStorage();
    if(!bucket)return json({ok:false,message:'媒体存储暂不可用。'},503);
    const updates=[];
    for(const id of body.sampleIds as string[]){
      const sample=await c.db.prepare('SELECT model_id,model_revision,protocol_hash,object_key,output_sha256,parameters_json FROM arena_samples WHERE id=?').bind(id)
        .first<{model_id:string;model_revision:string;protocol_hash:string;object_key:string;output_sha256:string;parameters_json:string}>();
      if(!sample)return json({ok:false,message:'其中一个样本不存在，请刷新队列。'},404);
      if(body.decision==='verified'){
        if(!items.some(x=>x.id===sample.model_id && x.kind==='model'))return json({ok:false,message:'样本模型不在受支持目录中。'},409);
        const object=await bucket.head(sample.object_key);
        if(!object || object.customMetadata?.sha256!==sample.output_sha256)return json({ok:false,message:'媒体缺失或摘要记录不一致，不能通过审核。'},409);
      }
      const parameters=JSON.parse(sample.parameters_json);
      parameters.review={decision:body.decision,notes:body.notes.trim(),reviewedAt:new Date().toISOString(),method:'designated-admin-manual-provenance-review'};
      updates.push(c.db.prepare('UPDATE arena_samples SET parameters_json=? WHERE id=?').bind(JSON.stringify(parameters),id));
    }
    await c.db.batch(updates);
    return reviewArenaSamples(new Request(request.url,{method:'POST',headers:request.headers,
      body:JSON.stringify({sampleIds:body.sampleIds,decision:body.decision})}),c);
  } catch{return json({ok:false,message:'审核未完成，请检查表单并稍后重试。'},503);}
}
