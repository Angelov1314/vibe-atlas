'use client';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowRight,ArrowUpRight,AudioLines,Check,CheckCircle2,FileCheck2,Film,Image as ImageIcon,Layers3,Loader2,RefreshCw,ShieldCheck,Shuffle,Upload} from 'lucide-react';
import {items,modalities,type Item} from '../lib/catalog';
import './arena.css';

type Props={onOpen:(item:Item)=>void;identity:any;notify:(s:string)=>void};
type Snapshot={protocols:any[];selectedProtocol:string|null;leaderboard:any;authenticated:boolean;isAdmin:boolean;capabilities:{adminReviewConfigured:boolean}};
const unsupported=new Set(['speech-recognition','audio-understanding','text-generation','visual-understanding','ocr','text-embedding','image-embedding']);
const supportedModalities=modalities.filter(m=>!unsupported.has(m.id));
const quickModes=[{id:'text-to-image',label:'图像',Icon:ImageIcon},{id:'text-to-video',label:'视频',Icon:Film},{id:'image-to-3d',label:'3D',Icon:Layers3},{id:'text-to-music',label:'音乐',Icon:AudioLines},{id:'text-to-sfx',label:'音效',Icon:AudioLines},{id:'text-to-speech',label:'语音',Icon:AudioLines}];
const mediaFamily=(id:string)=>['text-to-music','lyrics-to-song','audio-edit','text-to-sfx','text-to-speech','voice-cloning','source-separation'].includes(id)?'audio':['text-to-image','image-edit','inpainting','image-upscale','image-restore','segmentation','pbr-material','depth-estimation'].includes(id)?'image':'video';
const needsInput=(id:string)=>!['text-to-image','text-to-video','text-to-music','lyrics-to-song','text-to-sfx','text-to-speech','text-to-motion'].includes(id);
function Output({url,family,label}:{url:string;family:string;label:string}){
  if(family==='audio')return <div className="arena-audio"><AudioLines size={48} strokeWidth={1.3}/><p>{label}</p><audio controls preload="metadata" src={url} aria-label={label}/></div>;
  if(family==='video')return <video className="arena-output" controls playsInline preload="metadata" src={url} aria-label={label}/>;
  return <img className="arena-output" src={url} alt={label}/>;
}
function CandidatePreview({item}:{item:Item}){
  const [unavailable,setUnavailable]=useState(!item.image);
  return <span className="arena-candidate-preview" role={unavailable?'img':undefined} aria-label={unavailable?`${item.name} 的项目预览图片暂不可用`:undefined}>{unavailable?<span>{item.name.replace(/[^a-zA-Z]/g,'').slice(0,2) || item.name.slice(0,2)}</span>:<img src={item.image} alt={`${item.name} 官方项目预览`} loading="lazy" onError={()=>setUnavailable(true)}/>}</span>;
}
export function ChallengeBox({challenge,onToken}:{challenge:any;onToken:(token:string)=>void}){
  const container=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    let widget:any=null,disposed=false;
    const render=()=>{const api=(window as any).turnstile;if(!disposed && api && container.current)widget=api.render(container.current,{sitekey:challenge.siteKey,action:challenge.action,callback:onToken,'expired-callback':()=>onToken('')});};
    const existing=document.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com/turnstile"]');
    let script=existing;
    if((window as any).turnstile)render();else if(script)script.addEventListener('load',render);else{script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.addEventListener('load',render);document.head.appendChild(script);}
    return()=>{disposed=true;script?.removeEventListener('load',render);if(widget!==null)(window as any).turnstile?.remove(widget);};
  },[challenge.siteKey,challenge.action,onToken]);
  return <div className="arena-challenge"><p>验证后重新提交</p><div ref={container}/></div>;
}

export function Arena({onOpen,identity,notify}:Props){
  const [modality,setModality]=useState('text-to-image'),[protocol,setProtocol]=useState(''),[tab,setTab]=useState('play');
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
  const [assignment,setAssignment]=useState<any>(null),[reveal,setReveal]=useState<any>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [challenge,setChallenge]=useState<any>(null),[challengeToken,setChallengeToken]=useState('');
  const candidates=useMemo(()=>items.filter(x=>x.kind==='model' && x.modalities.includes(modality)),[modality]);
  const authenticated=Boolean(identity?.authenticated || snapshot?.authenticated);
  const activeProtocol=snapshot?.protocols.find(p=>p.hash===(protocol || snapshot.selectedProtocol));
  const currentMode=modalities.find(m=>m.id===modality);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    fetch(`/api/arena?modality=${encodeURIComponent(modality)}${protocol?`&protocol=${encodeURIComponent(protocol)}`:''}`,{signal:controller.signal,cache:'no-store'})
      .then(async r=>{const d:any=await r.json();if(!r.ok)throw new Error(d.message || '服务暂时不可用');return d;})
      .then(d=>setSnapshot(d)).catch(e=>{if(e.name!=='AbortError'){setError(e.message);setSnapshot(null);}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[modality,protocol,refresh]);
  const chooseMode=(id:string)=>{setModality(id);setProtocol('');setAssignment(null);setReveal(null);setMessage('');setChallenge(null);setChallengeToken('');};
  const assign=async()=>{
    if(!authenticated){notify('请先通过站点的 ChatGPT 登录验证。');return;}
    if(!activeProtocol){setMessage('还没有统一协议下的已审核样本。先提交一组真实输出。');return;}
    setBusy(true);setMessage('');setReveal(null);setAssignment(null);setChallenge(null);setChallengeToken('');
    try{const r=await fetch('/api/arena',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'assign',protocolHash:activeProtocol.hash})});const d:any=await r.json();
      if(!r.ok)throw new Error(d.message);setAssignment(d.assignment);if(!d.assignment)setMessage(d.message || '还没有你可以参与的可比样本。');
    }catch(e){setMessage(e instanceof Error?e.message:'无法获取对比，请稍后重试。');}finally{setBusy(false);}
  };
  const vote=async(winner:string)=>{
    if(!assignment || reveal || busy)return;setBusy(true);setMessage('');
    try{const r=await fetch('/api/arena',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'vote',assignmentId:assignment.id,winner,challengeToken,website:''})});const d:any=await r.json();
      if(d.error==='challenge_required' && d.siteKey){setChallenge(d);setMessage(d.message);return;}if(!r.ok)throw new Error(d.message);
      setReveal({...d,winner});setChallenge(null);setChallengeToken('');setRefresh(n=>n+1);notify(d.status==='quarantined'?'盲评已保存，等待完整性审核。':'盲评已保存，模型身份已揭晓。');
    }catch(e){setMessage(e instanceof Error?e.message:'评价未保存，请重试。');}finally{setBusy(false);}
  };
  const tokenCallback=useCallback((token:string)=>setChallengeToken(token),[]);
  const totalVerified=snapshot?.protocols.reduce((s,p)=>s+p.verifiedSamples,0) || 0;
  return <section className="page-width arena-page">
    <div className="arena-intro page-intro"><h1>模型 Arena</h1></div>
    <div className="arena-topline"><div className="arena-tabs" role="tablist" aria-label="Arena 功能">{[['play','参加盲评'],['upload','提交样本'],...(snapshot?.isAdmin?[['review','审核队列']]:[])].map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'selected':''} onClick={()=>setTab(id)}>{label}</button>)}</div><a className="text-link arena-guide-link" href="/docs/ARENA_LOCAL_GUIDE.md" download>评测说明.md<ArrowUpRight size={15}/></a></div>
    <div className="arena-modebar"><div className="arena-modes" aria-label="评测模态">{quickModes.map(({id,label,Icon})=><button key={id} className={modality===id?'selected':''} onClick={()=>chooseMode(id)}><Icon size={16}/>{label}</button>)}</div><label className="arena-task-select"><span className="sr-only">细分评测任务</span><select value={modality} onChange={e=>chooseMode(e.target.value)}>{supportedModalities.map(m=><option value={m.id} key={m.id}>{m.label}</option>)}</select></label></div>
    {tab==='play' && <>
      <div className="arena-protocol-row"><div><h2>{currentMode?.label} <span>{candidates.length} 个候选模型</span></h2></div><label><span>评测协议</span><select value={protocol || snapshot?.selectedProtocol || ''} disabled={!snapshot?.protocols.length} onChange={e=>{setProtocol(e.target.value);setAssignment(null);setReveal(null);}}><option value="" disabled>尚无已提交协议</option>{snapshot?.protocols.map(p=><option key={p.hash} value={p.hash}>{String(p.definition.name || p.hash.slice(0,12))} · {p.verifiedSamples} 个已审核样本</option>)}</select></label></div>
      {loading && !snapshot ? <div className="arena-loading"><Loader2 className="arena-spin"/>正在读取评测…</div> : error ? <div className="arena-empty arena-service-error"><ShieldCheck size={34}/><h3>盲评服务暂时不可用</h3><p>{error}</p><button className="button outline" onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={16}/>重新连接</button></div> : assignment ? <div className="arena-match">
        <div className="arena-prompt"><span>统一提示词</span><p>{assignment.prompt}</p><details><summary>查看生成协议与输入摘要</summary><pre>{JSON.stringify({protocol:assignment.protocol,inputSha256:assignment.inputSha256},null,2)}</pre></details></div>
        <div className="arena-pair">{(['a','b'] as const).map(side=><article className="arena-output-card" key={side}><header><span className="arena-letter">{side.toUpperCase()}</span>{reveal?<button onClick={()=>{const item=items.find(i=>i.id===reveal.models?.[side]);if(item)onOpen(item);}}>{items.find(i=>i.id===reveal.models?.[side])?.name || reveal.models?.[side]} <ArrowUpRight size={15}/></button>:<span>身份未揭晓</span>}{reveal && <small>{reveal.revisions?.[side]}</small>}</header><Output url={side==='a'?assignment.outputA:assignment.outputB} family={assignment.protocol?.mediaFamily || mediaFamily(modality)} label={`输出 ${side.toUpperCase()}`}/></article>)}</div>
        {reveal ? <div className="arena-reveal"><div><CheckCircle2 size={22}/><div><strong>{reveal.status==='quarantined'?'评价待完整性审核':'你的偏好已保存'}</strong><p>本票权重 {Number(reveal.weight).toFixed(2)}</p></div></div><button className="button primary" onClick={assign} disabled={busy}>下一组<ArrowRight size={16}/></button></div> : <div className="arena-vote-row"><span>哪一个更符合提示词、效果更好？</span><div>{[['a','A 更好'],['tie','不分上下'],['b','B 更好'],['both_bad','都不好']].map(([id,label])=><button key={id} className={`button ${id==='a'||id==='b'?'dark':'outline'}`} disabled={busy} onClick={()=>vote(id)}>{label}</button>)}</div></div>}
        {challenge && <ChallengeBox challenge={challenge} onToken={tokenCallback}/>}
      </div> : <div className="arena-empty"><h3>{totalVerified?'开始一组盲评':'暂无可评测样本'}</h3><div className="arena-empty-actions"><button className="button primary" onClick={totalVerified?assign:()=>setTab('upload')} disabled={busy}>{busy?<Loader2 className="arena-spin" size={16}/>:totalVerified?<Shuffle size={16}/>:<Upload size={16}/>} {totalVerified?'开始盲评':'提交第一组样本'}<ArrowRight size={16}/></button><a className="button outline" href="/docs/ARENA_LOCAL_GUIDE.md" download>评测说明</a></div><div className="arena-zero-stats"><span><strong>{totalVerified}</strong> 已核验样本</span><span><strong>{snapshot?.leaderboard?.totalBattles || 0}</strong> 当前协议有效比较</span><span><strong>{snapshot?.protocols.reduce((s,p)=>s+p.pendingSamples,0) || 0}</strong> 待核验样本</span></div></div>}
      {message && <div className="arena-message" role="status">{message}</div>}
      {snapshot && !snapshot.capabilities.adminReviewConfigured && !error && <div className="arena-review-note"><ShieldCheck size={17}/><p>审核管理员未配置，上传样本暂不参与盲评。</p></div>}
      {!!snapshot?.leaderboard?.models?.length && <div className="arena-results"><div className="arena-section-heading"><h3>当前协议的社区偏好</h3><a className="text-link" href="/docs/ARENA_LOCAL_GUIDE.md" download>评分说明<ArrowUpRight size={15}/></a></div><div className="arena-table"><div className="arena-table-head"><span>模型</span><span>暂定 Elo</span><span>有效比较</span></div>{snapshot.leaderboard.models.map((r:any)=><button key={r.id} className="arena-table-row" onClick={()=>{const p=items.find(x=>x.id===r.id);if(p)onOpen(p);}}><span>{items.find(x=>x.id===r.id)?.name || r.id}</span><strong>{Number(r.rating).toFixed(1)}</strong><span>{r.battles}</span></button>)}</div></div>}
      <div className="arena-candidates"><div className="arena-section-heading"><h3>候选模型</h3></div><div className="arena-candidate-grid">{candidates.map(item=><button key={item.id} className="arena-candidate" onClick={()=>onOpen(item)}><CandidatePreview item={item}/><div><strong>{item.name}</strong><p>{item.description}</p><small>{item.vram?`${item.vram} GB 参考显存`:'硬件需求见详情'} · {item.license}</small></div><ArrowUpRight size={17}/></button>)}</div></div>
    </>}
    {tab==='upload' && <UploadForm key={modality} modality={modality} authenticated={authenticated} candidates={candidates} notify={notify} onComplete={()=>setRefresh(n=>n+1)}/>}
    {tab==='review' && snapshot?.isAdmin && <ReviewPanel notify={notify} onComplete={()=>setRefresh(n=>n+1)}/>}
  </section>;
}

function UploadForm({modality,authenticated,candidates,notify,onComplete}:{modality:string;authenticated:boolean;candidates:Item[];notify:(s:string)=>void;onComplete:()=>void}){
  const family=mediaFamily(modality),is3d=['image-to-3d','multiview-to-3d','textured-mesh','camera-reconstruction'].includes(modality);
  const [state,setState]=useState<any>({modelA:candidates[0]?.id || '',modelB:candidates[1]?.id || '',revisionA:'',revisionB:'',prompt:'',negativePrompt:'',inputSha256:'',logA:'',logB:'',workflowSha256A:'',workflowSha256B:'',consent:false,noWatermark:false,
    protocol:{name:`${modalities.find(m=>m.id===modality)?.label} · 统一协议 v1`,width:family==='video'?1280:1024,height:family==='video'?720:1024,durationSeconds:family==='audio'?30:5,fps:24,sampleRate:44100,steps:30,seed:42,guidance:7,sampler:'',scheduler:'',precision:'bf16',hardware:'',backend:'',cameraProtocol:''}});
  const [fileA,setFileA]=useState<File|null>(null),[fileB,setFileB]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState<any>(null);
  const [challenge,setChallenge]=useState<any>(null),[token,setToken]=useState('');
  const change=(key:string,value:any)=>setState((s:any)=>({...s,[key]:value}));
  const param=(key:string,value:any)=>setState((s:any)=>({...s,protocol:{...s.protocol,[key]:value}}));
  const tokenCallback=useCallback((value:string)=>setToken(value),[]);
  const pick=(side:string,file:File|null)=>{if(file && file.size>12*1024*1024){setError('单个文件不能超过 12 MB。');return;}setError('');if(side==='a')setFileA(file);else setFileB(file);};
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();setError('');
    if(!authenticated){setError('请先完成站点的 ChatGPT 登录验证。');return;}
    if(!fileA || !fileB){setError('请分别上传两个模型的真实输出文件。');return;}
    if(state.modelA===state.modelB){setError('请选择两个不同的模型。');return;}
    setBusy(true);const form=new FormData();form.set('metadata',JSON.stringify({...state,modality,challengeToken:token,website:''}));form.set('fileA',fileA);form.set('fileB',fileB);
    try{const r=await fetch('/api/arena/upload',{method:'POST',body:form});const d:any=await r.json();if(d.error==='challenge_required' && d.siteKey){setChallenge(d);setError(d.message);return;}if(!r.ok)throw new Error(d.message);setReceipt(d);onComplete();notify('两份真实样本已保存，等待来源核验。');}
    catch(e){setError(e instanceof Error?e.message:'上传未完成，请稍后重试。');}finally{setBusy(false);}
  };
  if(receipt)return <div className="arena-upload-success"><CheckCircle2 size={44}/><h2>样本已保存</h2><p>{receipt.message}</p><span className="arena-status-pill">待来源与协议审核</span><dl><dt>协议摘要</dt><dd>{receipt.protocolHash}</dd><dt>提交编号</dt><dd>{receipt.sampleIds.join(' / ')}</dd></dl><button className="button outline" onClick={()=>{setReceipt(null);setFileA(null);setFileB(null);}}>继续提交另一组<ArrowRight size={16}/></button></div>;
  return <form className="arena-upload-form" onSubmit={submit}><div className="arena-form-heading"><h2>提交样本</h2><a className="text-link" href="/docs/ARENA_LOCAL_GUIDE.md" download>填写说明.md<ArrowUpRight size={15}/></a></div>
    {candidates.length<2 && <div className="arena-message">候选模型不足两个，请选择其他任务。</div>}
    <section className="arena-form-section"><h3>模型与输出</h3><div className="arena-upload-pair">{(['a','b'] as const).map(side=>{const upper=side.toUpperCase(),file=side==='a'?fileA:fileB;return <div className="arena-upload-side" key={side}><h4>输出 {upper}</h4><label>模型<select required value={state[`model${upper}`]} onChange={e=>change(`model${upper}`,e.target.value)}>{candidates.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>精确版本 / revision<input required minLength={3} maxLength={180} value={state[`revision${upper}`]} onChange={e=>change(`revision${upper}`,e.target.value)} placeholder="例如权重 revision 或 Git 提交 SHA"/></label><label className={`arena-file-drop ${file?'has-file':''}`}><Upload size={23}/><strong>{file?file.name:`选择 ${family==='image'?'图像':family==='video'?'视频':'音频'}文件`}</strong><span>{file?`${(file.size/1024/1024).toFixed(2)} MB`:'最多 12 MB'}</span><input required type="file" accept={family==='image'?'.png,.jpg,.jpeg,.webp':family==='video'?'.mp4,.webm':'.wav,.mp3'} onChange={e=>pick(side,e.target.files?.[0] || null)}/></label></div>;})}</div>{is3d && <p className="arena-field-note">3D 样本：固定相机转台视频</p>}</section>
    <section className="arena-form-section"><h3>统一提示词与输入</h3><label>两个模型使用的同一提示词<textarea required minLength={2} maxLength={4000} rows={4} value={state.prompt} onChange={e=>change('prompt',e.target.value)} placeholder="保留实际发送给模型的提示词，包括语言、约束和歌词等。"/></label><div className="arena-fields two"><label>统一负面提示词（可选）<textarea rows={2} maxLength={2000} value={state.negativePrompt} onChange={e=>change('negativePrompt',e.target.value)}/></label><label>输入文件 / 输入清单 SHA-256 {needsInput(modality)?'（必填）':'（如有）'}<input required={needsInput(modality)} pattern="[a-fA-F0-9]{64}" value={state.inputSha256} onChange={e=>change('inputSha256',e.target.value)} placeholder="64 位十六进制摘要"/></label></div></section>
    <section className="arena-form-section"><h3>相同的生成与评测协议</h3><label>协议名称<input required minLength={3} maxLength={100} value={state.protocol.name} onChange={e=>param('name',e.target.value)}/></label><div className="arena-fields four">{[...(family!=='audio'?[['width','宽度 px',64,8192],['height','高度 px',64,8192]]:[]),...(family!=='image'?[['durationSeconds','时长 s',0.1,600]]:[]),...(family==='video'?[['fps','帧率',1,120]]:[]),...(family==='audio'?[['sampleRate','采样率 Hz',8000,192000]]:[]),['steps','采样 / 迭代步数',0,1000],['seed','随机种子',0,4294967295],['guidance','引导强度',0,100]].map(([key,label,min,max])=><label key={key}>{label}<input required type="number" min={min} max={max} step={key==='guidance'||key==='durationSeconds'||key==='fps'?'any':1} value={state.protocol[String(key)]} onChange={e=>param(String(key),Number(e.target.value))}/></label>)}</div><div className="arena-fields three">{[['sampler','采样器','例如 Euler / native'],['scheduler','调度器','例如 normal / native'],['precision','精度 / 量化','例如 bf16 / fp16']].map(([key,label,placeholder])=><label key={key}>{label}<input required value={state.protocol[key]} placeholder={placeholder} onChange={e=>param(key,e.target.value)}/></label>)}</div><div className="arena-fields two"><label>相同的硬件环境<input required minLength={3} maxLength={160} value={state.protocol.hardware} onChange={e=>param('hardware',e.target.value)} placeholder="GPU、显存、驱动及操作系统"/></label><label>相同的推理后端与版本<input required minLength={3} maxLength={160} value={state.protocol.backend} onChange={e=>param('backend',e.target.value)} placeholder="例如 ComfyUI commit / Diffusers 版本"/></label></div>{is3d && <label>相机、灯光与渲染设置<textarea required minLength={20} maxLength={1200} rows={3} value={state.protocol.cameraProtocol} onChange={e=>param('cameraProtocol',e.target.value)} placeholder="记录相同的镜头轨迹、焦距、光源、背景、材质与渲染器设置。"/></label>}</section>
    <section className="arena-form-section"><h3>供管理员核验的生成记录</h3><div className="arena-fields two">{(['A','B'] as const).map(side=><div key={side}><label>模型 {side} 生成记录<textarea required minLength={40} maxLength={6000} rows={5} value={state[`log${side}`]} onChange={e=>change(`log${side}`,e.target.value)} placeholder="粘贴实际生成日志、权重来源、运行时间与完整参数；如有输入，请说明审核者如何核验。不要包含密钥或私人信息。"/></label><label>工作流文件 SHA-256（可选）<input pattern="[a-fA-F0-9]{64}" value={state[`workflowSha256${side}`]} onChange={e=>change(`workflowSha256${side}`,e.target.value)}/></label></div>)}</div></section>
    <div className="arena-consents"><label><input required type="checkbox" checked={state.consent} onChange={e=>change('consent',e.target.checked)}/><span>我有权公开这些输出与提示词，已取得涉及人物、声音及输入素材所需的授权，并同意样本用于社区评测。</span></label><label><input required type="checkbox" checked={state.noWatermark} onChange={e=>change('noWatermark',e.target.checked)}/><span>两份输出遵循上述同一协议，未添加有利于一方的后处理，且没有直接透露模型身份的信息。</span></label></div>
    {challenge && <ChallengeBox challenge={challenge} onToken={tokenCallback}/>}{error && <div className="arena-message" role="alert">{error}</div>}
    <div className="arena-form-submit"><span>提交后待审核</span><button className="button primary" disabled={busy || candidates.length<2} type="submit">{busy?<Loader2 className="arena-spin" size={17}/>:<Upload size={17}/>} {busy?'正在提交…':'提交审核'}</button></div>
  </form>;
}

function ReviewPanel({notify,onComplete}:{notify:(s:string)=>void;onComplete:()=>void}){
  const [samples,setSamples]=useState<any[]>([]),[selected,setSelected]=useState<string[]>([]),[status,setStatus]=useState('pending'),[notes,setNotes]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const load=useCallback(async()=>{setBusy(true);try{const r=await fetch(`/api/arena/review?status=${status}`,{cache:'no-store'});const d:any=await r.json();if(!r.ok)throw new Error(d.message);setSamples(d.samples);setSelected([]);}catch(e){setError(e instanceof Error?e.message:'无法读取审核队列。');}finally{setBusy(false);}},[status]);
  useEffect(()=>{load();},[load]);
  const review=async(decision:string)=>{setBusy(true);setError('');try{const r=await fetch('/api/arena/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sampleIds:selected,decision,notes,confirmed})});const d:any=await r.json();if(!r.ok)throw new Error(d.message);notify(decision==='verified'?'样本已通过指定管理员核验。':'样本已拒绝或撤销核验。');await load();onComplete();setNotes('');setConfirmed(false);}catch(e){setError(e instanceof Error?e.message:'审核未完成。');}finally{setBusy(false);}};
  return <div className="arena-review-panel"><div className="arena-form-heading"><h2>样本审核</h2><select value={status} onChange={e=>setStatus(e.target.value)}><option value="pending">待审核</option><option value="verified">已核验 / 撤销</option></select></div>{!samples.length && <div className="arena-empty"><FileCheck2 size={38}/><h3>{busy?'正在读取…':'当前队列为空'}</h3></div>}<div className="arena-review-grid">{samples.map(s=><article className="arena-review-card" key={s.id}><label className="arena-review-select"><input type="checkbox" checked={selected.includes(s.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,s.id]:old.filter(id=>id!==s.id))}/><strong>{items.find(i=>i.id===s.model_id)?.name || s.model_id}</strong><small>{s.model_revision}</small></label><Output url={s.mediaUrl} family={s.media_type.split('/')[0]} label="管理员核验样本"/><details><summary>查看来源、提示词和完整参数</summary><pre>{JSON.stringify({id:s.id,outputSha256:s.output_sha256,protocolHash:s.protocol_hash,...s.parameters},null,2)}</pre></details></article>)}</div>{samples.length>0 && <div className="arena-review-actions"><label>核验依据 / 拒绝原因<textarea rows={3} minLength={20} maxLength={1500} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="记录如何核实版本、来源、输入、统一参数，以及有没有水印或元数据泄露身份。"/></label><label className="arena-review-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>我已核对生成来源、版本、参数、输入授权与输出，确认媒体不会直接透露模型身份。</span></label><div><span>已选 {selected.length} 个样本</span><button className="button outline" disabled={busy||!selected.length||!confirmed||notes.trim().length<20} onClick={()=>review('rejected')}>拒绝 / 撤销核验</button><button className="button primary" disabled={busy||!selected.length||!confirmed||notes.trim().length<20} onClick={()=>review('verified')}>核验通过<Check size={16}/></button></div></div>}{error && <p className="arena-message" role="alert">{error}</p>}</div>;
}
