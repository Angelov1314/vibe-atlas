'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Loader2, Monitor, X } from 'lucide-react';
import { items, type Item } from '../lib/catalog';

type Message = { role: 'user' | 'assistant'; text: string; matches?: Item[] };

export function AtlasChat({ prefill, onClose, onOpen, onLocal }: {
  prefill: string; onClose: () => void; onOpen: (item: Item) => void; onLocal: () => void;
}) {
  const [input, setInput] = useState(prefill);
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setInput(prefill); field.current?.focus(); }, [prefill]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send(text = input) {
    if (!text.trim() || busy) return;
    setInput('');
    setMessages(previous => [...previous, { role: 'user', text }]);
    setBusy(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await response.json() as { answer: string; itemIds?: string[]; message?: string; error?: string };
      if (!response.ok) throw new Error(data.message || data.error || '检索暂时不可用');
      const matches = (data.itemIds || []).map((id: string) => items.find(item => item.id === id)).filter((item): item is Item => Boolean(item));
      setMessages(previous => [...previous, { role: 'assistant', text: data.answer, matches }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : '请稍后重试';
      setMessages(previous => [...previous, { role: 'assistant', text: `检索暂时不可用：${message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return <aside className="chat-panel" aria-label="Atlas 检索助手">
    <div className="chat-header">
      <div><strong>Atlas</strong><span>目录检索</span></div>
      <button className="icon-button" onClick={onClose} aria-label="关闭助手"><X size={20} /></button>
    </div>
    <div className="chat-messages" aria-live="polite" aria-busy={busy}>
      {messages.length === 0 ? <div className="chat-welcome">
        <h2>你想做什么？</h2>
        {[
          '用 Three.js 做一个 3D 作品集',
          '找可商用的本地视频模型',
          '把一张图片变成 3D 模型',
          '开发小游戏并自动测试',
        ].map(question => <button key={question} onClick={() => send(question)}>
          <span>{question}</span><ArrowUpRight size={16} />
        </button>)}
      </div> : messages.map((message, index) => <div key={index} className={`chat-message ${message.role}`}>
        <p>{message.text}</p>
        {message.matches?.map(item => <button key={item.id} className="chat-result" onClick={() => onOpen(item)}>
          <div><strong>{item.name}</strong><span>{item.description}</span></div><ArrowUpRight size={16} />
        </button>)}
      </div>)}
      {busy && <div className="chat-thinking"><Loader2 size={16} className="spin" />正在检索</div>}
      <div ref={end} />
    </div>
    <div className="chat-bottom">
      <form onSubmit={event => { event.preventDefault(); void send(); }}>
        <textarea ref={field} value={input} onChange={event => setInput(event.target.value)}
          placeholder="任务、设备、许可要求…" aria-label="向 Atlas 提问" rows={2} maxLength={1800}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
              event.preventDefault(); void send();
            }
          }} />
        <button className="send-button" disabled={busy || !input.trim()} aria-label="发送"><ArrowRight size={20} /></button>
      </form>
      <button className="local-chat-link" onClick={onLocal}><Monitor size={16} />连接本地模型<ArrowRight size={15} /></button>
    </div>
  </aside>;
}
