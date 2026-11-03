import {ensureIdentity,verifyTurnstile} from '../../../../lib/community';
import {getCommunityConfig,getStorage} from '../../../../lib/server';
import {items,modalities} from '../../../../lib/catalog';

const FILE_LIMIT = 12 * 1024 * 1024;
const BODY_LIMIT = FILE_LIMIT * 2 + 64 * 1024;
const json = (value:unknown,status=200) => Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const imageTasks = new Set(['text-to-image','image-edit','inpainting','image-upscale','image-restore','segmentation','pbr-material','depth-estimation']);
const videoTasks = new Set(['text-to-video','image-to-video','video-audio','portrait-animation','lip-sync','frame-interpolation','video-segmentation','image-to-3d','multiview-to-3d','textured-mesh','camera-reconstruction','text-to-motion']);
const audioTasks = new Set(['text-to-music','lyrics-to-song','audio-edit','text-to-sfx','text-to-speech','voice-cloning','source-separation']);
const generatedWithoutInput = new Set(['text-to-image','text-to-video','text-to-music','lyrics-to-song','text-to-sfx','text-to-speech','text-to-motion']);

class UploadError extends Error { constructor(message:string,public status=400) { super(message); } }
const text = (value:unknown,name:string,min:number,max:number) => {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) throw new UploadError(`${name}需为 ${min}–${max} 个字符。`);
  return value.trim().normalize('NFC');
};
const integer = (value:unknown,name:string,min:number,max:number) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new UploadError(`${name}超出允许范围。`);
  return value;
};
const number = (value:unknown,name:string,min:number,max:number) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new UploadError(`${name}超出允许范围。`);
  return value;
};
const digest = async (value:string | Uint8Array) => {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer))].map(n=>n.toString(16).padStart(2,'0')).join('');
};
const ascii = (bytes:Uint8Array,start:number,end:number) => String.fromCharCode(...bytes.slice(start,end));
function sniff(bytes:Uint8Array):string | null {
  if (bytes.length < 12) return null;
  if ([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) return 'image/png';
  if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'image/jpeg';
  if (ascii(bytes,0,4)==='RIFF' && ascii(bytes,8,12)==='WEBP') return 'image/webp';
  if (ascii(bytes,0,4)==='RIFF' && ascii(bytes,8,12)==='WAVE') return 'audio/wav';
  if (ascii(bytes,4,8)==='ftyp' && /^(isom|iso[2-9]|avc1|mp4[12]|M4V |dash|MSNV)$/.test(ascii(bytes,8,12))) return 'video/mp4';
  if ([26,69,223,163].every((v,i)=>bytes[i]===v) && ascii(bytes,0,Math.min(bytes.length,4096)).includes('webm')) return 'video/webm';
  if (ascii(bytes,0,3)==='ID3' || (bytes[0]===255 && (bytes[1]&224)===224 && (bytes[1]&6)!==0 && (bytes[2]&12)!==12)) return 'audio/mpeg';
  return null;
}
function dimensions(bytes:Uint8Array,mime:string):{width:number;height:number} | null {
  const read32 = (o:number) => (bytes[o]*16777216 + (bytes[o+1]<<16) + (bytes[o+2]<<8) + bytes[o+3]);
  if (mime==='image/png' && bytes.length>=24) return {width:read32(16),height:read32(20)};
  if (mime==='image/webp' && bytes.length>=30) {
    const chunk = ascii(bytes,12,16);
    if (chunk==='VP8X') return {width:1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),height:1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)};
    if (chunk==='VP8 ' && bytes[23]===157 && bytes[24]===1 && bytes[25]===42)
      return {width:(bytes[26]+(bytes[27]<<8))&16383,height:(bytes[28]+(bytes[29]<<8))&16383};
    if (chunk==='VP8L' && bytes[20]===47) return {width:1+bytes[21]+((bytes[22]&63)<<8),height:1+(bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&15)<<10)};
  }
  if (mime==='image/jpeg') {
    let offset=2;
    while(offset+8<bytes.length) {
      if(bytes[offset]!==255){offset++;continue;}
      const marker=bytes[offset+1];
      if(marker===218 || marker===217)break;
      if(marker===255){offset++;continue;}
      const length=(bytes[offset+2]<<8)+bytes[offset+3];
      if(length<2)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))
        return {width:(bytes[offset+7]<<8)+bytes[offset+8],height:(bytes[offset+5]<<8)+bytes[offset+6]};
      offset+=length+2;
    }
  }
  return null;
}

async function boundedForm(request:Request) {
  if (!request.body) throw new UploadError('上传内容为空。');
  const contentType=request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data;') || contentType.length>300) throw new UploadError('请使用媒体上传表单。',415);
  if (Number(request.headers.get('content-length'))>BODY_LIMIT) throw new UploadError('两个文件总计不能超过 24 MB。',413);
  let count=0;
  const limited=request.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){
    count+=chunk.byteLength;
    if(count>BODY_LIMIT)throw new UploadError('两个文件总计不能超过 24 MB。',413);
    controller.enqueue(chunk);
  }}));
  try { return await new Response(limited,{headers:{'Content-Type':contentType}}).formData(); }
  catch(error) { if(error instanceof UploadError)throw error;throw new UploadError('无法读取上传表单，或上传内容超过限制。'); }
}

export async function POST(request:Request) {
  let cleanup: (()=>Promise<unknown>) | null=null;
  try {
    const c=await getCommunityConfig(request);
    if(!c.identity?.verified)return json({ok:false,error:'authentication_required',message:'请先登录，再提交真实生成样本。'},401);
    if(request.headers.get('origin')!==new URL(c.origin).origin)return json({ok:false,message:'请求来源不匹配。'},403);
    const user=await ensureIdentity(c);
    if(user.state==='suspended')return json({ok:false,message:'账号正在审核，暂不能上传样本。'},403);
    const now=Date.now(),minute=Math.floor(now/60000),day=Math.floor(now/86400000);
    const rate=await c.db.batch([
      c.db.prepare('INSERT INTO rate_buckets(bucket_key,hits,expires_at) VALUES(?,1,?) ON CONFLICT(bucket_key) DO UPDATE SET hits=hits+1 RETURNING hits').bind(`arena_upload:m:${user.id}:${minute}`,(minute+1)*60000),
      c.db.prepare('INSERT INTO rate_buckets(bucket_key,hits,expires_at) VALUES(?,1,?) ON CONFLICT(bucket_key) DO UPDATE SET hits=hits+1 RETURNING hits').bind(`arena_upload:d:${user.id}:${day}`,(day+1)*86400000),
    ]);
    if(!rate[0]?.results?.[0]?.hits || !rate[1]?.results?.[0]?.hits)throw new UploadError('上传配额服务暂时不可用。',503);
    if(Number(rate[0].results![0].hits)>2 || Number(rate[1].results![0].hits)>8)
      return json({ok:false,error:'rate_limited',message:'上传较频繁。每分钟最多 2 组，每天最多 8 组，请稍后再试。'},429);
    const form=await boundedForm(request),raw=form.get('metadata');
    if(typeof raw!=='string' || new TextEncoder().encode(raw).length>32768)throw new UploadError('样本说明过大或格式错误。');
    let m:Record<string,any>;
    try { m=JSON.parse(raw); } catch {throw new UploadError('样本说明不是有效的 JSON。');}
    if(!m || Array.isArray(m) || typeof m!=='object')throw new UploadError('样本说明格式错误。');
    if(typeof m.website==='string' && m.website.length>0)throw new UploadError('上传未通过完整性检查。',403);
    if(c.challengeMode==='required' && !await verifyTurnstile(m.challengeToken,c,'arena_upload'))
      return json({ok:false,error:c.turnstileSecret?'challenge_required':'challenge_unavailable',siteKey:c.turnstileSiteKey || null,
        action:'arena_upload',message:'此次上传需要人机验证；样本尚未保存。'},c.turnstileSecret?403:503);
    const modality=text(m.modality,'评测任务',2,80);
    const mediaFamily=imageTasks.has(modality)?'image':videoTasks.has(modality)?'video':audioTasks.has(modality)?'audio':null;
    if(!mediaFamily || !modalities.some(x=>x.id===modality))throw new UploadError('该任务暂不使用媒体盲评。');
    const modelA=items.find(x=>x.id===m.modelA && x.kind==='model' && x.modalities.includes(modality));
    const modelB=items.find(x=>x.id===m.modelB && x.kind==='model' && x.modalities.includes(modality));
    if(!modelA || !modelB || modelA.id===modelB.id)throw new UploadError('请选择支持当前任务的两个不同目录模型。');
    const revisionA=text(m.revisionA,'模型 A 版本',3,180),revisionB=text(m.revisionB,'模型 B 版本',3,180);
    if(!/^[\w.\-/:@+]+$/.test(revisionA) || !/^[\w.\-/:@+]+$/.test(revisionB))throw new UploadError('模型版本应使用版本号、仓库 revision 或提交 SHA。');
    if([revisionA,revisionB].some(value=>/^(main|master|latest|head|dev|stable)$/i.test(value)))throw new UploadError('请记录具体版本或提交 SHA，不能使用会变化的 main、latest 等分支别名。');
    const prompt=text(m.prompt,'提示词',2,4000),negativePrompt=typeof m.negativePrompt==='string'?m.negativePrompt.trim().slice(0,2000):'';
    const inputSha256=typeof m.inputSha256==='string'?m.inputSha256.trim().toLowerCase():'';
    if(inputSha256 && !/^[a-f0-9]{64}$/.test(inputSha256))throw new UploadError('输入文件的 SHA-256 应为 64 位十六进制字符串。');
    if(!generatedWithoutInput.has(modality) && !inputSha256)throw new UploadError('这项任务需要输入文件或输入清单的 SHA-256，才能核对输入一致。');
    if(m.consent!==true || m.noWatermark!==true)throw new UploadError('需确认你有权公开这些样本，并已移除可揭示模型身份的水印。');
    const p=m.protocol;
    if(!p || typeof p!=='object' || Array.isArray(p))throw new UploadError('请填写统一的生成与输出协议。');
    const protocol={schemaVersion:1,name:text(p.name,'协议名称',3,100),modality,mediaFamily,
      representation:modality.includes('3d') || modality==='textured-mesh' || modality==='camera-reconstruction'?'fixed-camera-turntable':'native-output',
      width:mediaFamily==='audio'?0:integer(p.width,'输出宽度',64,8192),height:mediaFamily==='audio'?0:integer(p.height,'输出高度',64,8192),
      durationSeconds:mediaFamily==='image'?0:number(p.durationSeconds,'输出时长',0.1,600),
      fps:mediaFamily==='video'?number(p.fps,'帧率',1,120):0,sampleRate:mediaFamily==='audio'?integer(p.sampleRate,'采样率',8000,192000):0,
      steps:integer(p.steps,'生成步数',0,1000),seed:integer(p.seed,'随机种子',0,4294967295),guidance:number(p.guidance,'引导强度',0,100),
      sampler:text(p.sampler,'采样器',1,80),scheduler:text(p.scheduler,'调度器',1,80),precision:text(p.precision,'精度',2,30),
      hardware:text(p.hardware,'硬件环境',3,160),backend:text(p.backend,'推理后端及版本',3,160),negativePrompt,
      evaluation:'prompt-adherence-and-perceptual-quality',postProcessing:'none; 3D uses the declared fixed-camera turntable',
      cameraProtocol:typeof p.cameraProtocol==='string'?p.cameraProtocol.trim().slice(0,1200):''};
    if(protocol.representation==='fixed-camera-turntable' && protocol.cameraProtocol.length<20)
      throw new UploadError('3D 对比请填写相同的相机轨迹、光照、材质与渲染设置。');
    const publicDefinition=JSON.stringify(protocol).toLowerCase();
    if([modelA,modelB].some(model=>[model.id,model.name].some(name=>name.length>=4 && publicDefinition.includes(name.toLowerCase()))))
      throw new UploadError('协议会向评委公开，请从协议名称与公开参数中移除具体模型身份；版本与来源放入各自的生成记录。');
    const logA=text(m.logA,'模型 A 生成记录',40,6000),logB=text(m.logB,'模型 B 生成记录',40,6000);
    const workflowA=typeof m.workflowSha256A==='string'?m.workflowSha256A.trim().toLowerCase():'';
    const workflowB=typeof m.workflowSha256B==='string'?m.workflowSha256B.trim().toLowerCase():'';
    if([workflowA,workflowB].some(x=>x && !/^[a-f0-9]{64}$/.test(x)))throw new UploadError('工作流 SHA-256 格式不正确。');
    const fileA=form.get('fileA'),fileB=form.get('fileB');
    if(!(fileA instanceof File) || !(fileB instanceof File))throw new UploadError('需要上传两个真实媒体文件。');
    if(fileA.size<12 || fileB.size<12 || fileA.size>FILE_LIMIT || fileB.size>FILE_LIMIT)
      throw new UploadError('每个文件需大于 12 字节且不超过 12 MB。',413);
    const bytesA=new Uint8Array(await fileA.arrayBuffer()),bytesB=new Uint8Array(await fileB.arrayBuffer());
    const typeA=sniff(bytesA),typeB=sniff(bytesB);
    if(!typeA || !typeB || !typeA.startsWith(mediaFamily+'/') || !typeB.startsWith(mediaFamily+'/'))
      throw new UploadError('文件内容与任务不匹配；仅支持 PNG、JPEG、WebP、MP4、WebM、WAV 和 MP3。',415);
    const permittedDeclared=(type:string,actual:string)=>!type || type==='application/octet-stream' || type===actual || (actual==='audio/wav' && ['audio/wave','audio/x-wav'].includes(type));
    if(!permittedDeclared(fileA.type,typeA) || !permittedDeclared(fileB.type,typeB))throw new UploadError('文件 MIME 声明与真实内容不一致。',415);
    const dimA=dimensions(bytesA,typeA),dimB=dimensions(bytesB,typeB);
    if([dimA,dimB].some(dim=>dim && (dim.width!==protocol.width || dim.height!==protocol.height)))
      throw new UploadError('上传图片的实际尺寸与统一协议不一致。');
    const [hashA,hashB,protocolHash,promptHash]=await Promise.all([digest(bytesA),digest(bytesB),digest(JSON.stringify(protocol)),digest(JSON.stringify({prompt,inputSha256}))]);
    if(hashA===hashB)throw new UploadError('两个输出文件完全相同，不能作为不同模型的盲评样本。');
    const duplicate=await c.db.prepare("SELECT id FROM arena_samples WHERE output_sha256 IN (?,?) AND provenance_status!='rejected' LIMIT 1").bind(hashA,hashB).first();
    if(duplicate)throw new UploadError('其中一个输出已提交，无需重复上传同一文件。',409);
    const bucket=await getStorage();
    if(!bucket)throw new UploadError('媒体存储暂未就绪。',503);
    const idA=crypto.randomUUID(),idB=crypto.randomUUID(),keyA=`arena/${crypto.randomUUID()}`,keyB=`arena/${crypto.randomUUID()}`;
    cleanup=()=>bucket.delete([keyA,keyB]);
    const writes=await Promise.allSettled([
      bucket.put(keyA,bytesA,{httpMetadata:{contentType:typeA},customMetadata:{sha256:hashA}}),
      bucket.put(keyB,bytesB,{httpMetadata:{contentType:typeB},customMetadata:{sha256:hashB}}),
    ]);
    if(writes.some(x=>x.status==='rejected'))throw new UploadError('媒体上传未完成，请重试。',503);
    const common={prompt,inputSha256,protocol,publicationConsent:true,noIdentifyingWatermark:true};
    const insert=(id:string,model:string,revision:string,hash:string,key:string,type:string,size:number,log:string,workflow:string,dimension:unknown)=>
      c.db.prepare(`INSERT INTO arena_samples(id,model_id,model_revision,protocol_hash,prompt_hash,output_sha256,object_key,submitted_by,media_type,byte_size,parameters_json,provenance_status,consent_to_publish,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,'pending',1,?)`).bind(id,model,revision,protocolHash,promptHash,hash,key,user.id,type,size,
          JSON.stringify({...common,provenance:{generationLog:log,workflowSha256:workflow || null,source:'uploader-declaration-pending-review'},observedDimensions:dimension}),now);
    await c.db.batch([
      c.db.prepare('INSERT INTO arena_protocols(hash,modality,definition_json,created_at) VALUES(?,?,?,?) ON CONFLICT(hash) DO NOTHING').bind(protocolHash,modality,JSON.stringify(protocol),now),
      insert(idA,modelA.id,revisionA,hashA,keyA,typeA,fileA.size,logA,workflowA,dimA),
      insert(idB,modelB.id,revisionB,hashB,keyB,typeB,fileB.size,logB,workflowB,dimB),
    ]);
    cleanup=null;
    return json({ok:true,status:'pending',sampleIds:[idA,idB],protocolHash,adminReviewConfigured:Boolean(c.adminSubject),
      message:c.adminSubject?'两个样本已保存，等待管理员核验来源和统一参数后进入盲评。':'两个样本已保存为待审核；站点配置明确的审核管理员后才能开启盲评。'},201);
  } catch(error) {
    if(cleanup)try{await cleanup();}catch{/* An operational cleanup retry may be required; never reveal object keys. */}
    return json({ok:false,error:'upload_failed',message:error instanceof UploadError?error.message:'上传暂时未完成，请稍后重试。'},error instanceof UploadError?error.status:503);
  }
}
