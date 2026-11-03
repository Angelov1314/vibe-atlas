/** Task constraints precede lexical relevance. No claimed semantic/LLM search. */
export type RetrievalCandidate={kind:string;modalities:string[];tags:string[];license:string;licenseClass:string};
export type TaskIntent={id:string;label:string;modalities:string[]};

export function detectTaskIntents(message:string):TaskIntent[]{
 const q=message.toLowerCase().replace(/[＿_]/g,' ');
 const intents:TaskIntent[]=[];
 const image3d=/\b(?:image|photo|picture)s?[- ]to[- ]3d\b|\b2d\s*(?:to|→|->|2|[-–])\s*3d\b|(?:图生|图转)\s*(?:3d|三维)|单图.{0,12}(?:3d|三维|重建)|(?:图片|图像|照片).{0,24}(?:转|变|生成|重建).{0,12}(?:3d|三维)|(?:image|photo|picture).{0,30}(?:into|to).{0,12}3d|(?:3d|三维).{0,14}(?:重建|生成).{0,14}(?:图片|图像|照片)/i.test(q);
 if(image3d){
  const multiview=/多视图|多张(?:图片|图像|照片)|multi[- ]?view/.test(q);
  intents.push({id:'image-to-3d',label:multiview?'多视图三维重建':'单图转三维',modalities:[multiview?'multiview-to-3d':'image-to-3d']});
 }
 const asr=/语音转(?:文字|文本)|音频转(?:文字|文本)|视频转(?:文字|文本)|语音识别|音频转录|(?:音频|语音|视频).{0,10}(?:转写|转录)|speech[- ]to[- ]text|\basr\b|\btranscrib(?:e|ing|tion)\b/i.test(q);
 const tts=/文字转语音|文本转语音|语音合成|(?:生成|合成).{0,8}旁白|旁白.{0,8}(?:生成|模型)|text[- ]to[- ]speech|\btts\b/i.test(q);
 if(asr)intents.push({id:'speech-recognition',label:'语音识别 / 转录',modalities:['speech-recognition']});
 if(tts)intents.push({id:'text-to-speech',label:'语音合成 / 旁白',modalities:['text-to-speech']});
 const imageVideo=/图生视频|(?:图片|图像|照片).{0,16}(?:转|变|生成).{0,8}视频|image[- ]to[- ]video/i.test(q);
 const textVideo=/文生视频|(?:文字|文本).{0,12}(?:转|生成).{0,8}视频|text[- ]to[- ]video/i.test(q);
 const video=/视频生成(?!字幕)|生成.{0,12}视频|video\s+(?:generation|generator|models?)|(?:generate|create).{0,20}videos?/i.test(q);
 if(imageVideo||textVideo||video){
  const modalities=imageVideo&&!textVideo?['image-to-video']:textVideo&&!imageVideo?['text-to-video']:['text-to-video','image-to-video'];
  intents.push({id:'video-generation',label:modalities.length===2?'视频生成':imageVideo?'图生视频':'文生视频',modalities});
 }
 if(/text[- ]to[- ]music|lyrics[- ]to[- ]song|(?:音乐|歌曲|作曲).{0,12}(?:生成|模型)|生成.{0,12}(?:音乐|歌曲)|\bmusic\s+(?:generation|generator|models?)|\b(?:generate|create)\s+(?:\w+\s+){0,4}(?:music|songs?)\b/i.test(q)){
  intents.push({id:'music-generation',label:'音乐 / 歌曲生成',modalities:['text-to-music','lyrics-to-song']});
 }
 if(/text[- ]to[- ](?:sfx|sound|audio)|(?:音效|环境声|sfx).{0,12}(?:生成|模型)|生成.{0,12}(?:音效|环境声)|\b(?:sfx|sound effects?)\s+(?:generation|generator|models?)|\b(?:generate|create)\s+(?:\w+\s+){0,4}(?:sfx|sound effects?)\b/i.test(q)){
  intents.push({id:'sfx-generation',label:'音效 / 环境声生成',modalities:['text-to-sfx']});
 }
 return intents;
}

export function retrieveWithIntent<T extends RetrievalCandidate>(message:string,all:T[],search:(query:string,pool:T[])=>T[],limit=4){
 const taskIntents=detectTaskIntents(message);
 const commercial=/商用|商业|commercial/i.test(message);
 const modelOnly=taskIntents.length>0||/模型|\bmodels?\b|open[- ]weights?|图片生成|本地.*图/i.test(message);
 let pool=modelOnly?all.filter(p=>p.kind==='model'):all;
 if(taskIntents.length){
  const allowed=new Set(taskIntents.flatMap(t=>t.modalities));
  pool=pool.filter(p=>[...(p.modalities||[]),...(p.tags||[])].some(tag=>allowed.has(tag)));
 }
 if(commercial)pool=pool.filter(p=>p.kind==='model'
  ?p.licenseClass==='permissive-open-weights'
  :p.licenseClass==='open-source'&&/MIT|Apache|BSD|ISC/.test(p.license));
 const ranked=search(message,pool);
 // Explicit task tags themselves are real evidence when a language variant has
 // no lexical overlap. Never fill a constrained result with off-task projects.
 const taskTagFallback=ranked.length===0&&taskIntents.length>0;
 const result=(taskTagFallback?pool:ranked).slice(0,limit);
 return {result,constraints:{commercial,modelOnly,taskIntents,taskMatch:'any-explicit-task' as const},taskTagFallback,candidateCount:pool.length};
}
