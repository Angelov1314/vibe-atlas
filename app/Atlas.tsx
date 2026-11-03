'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, Bookmark, Check, ChevronDown, LayoutGrid,
  List, Menu, MessageCircle, Plus, Scale, Search, SlidersHorizontal, Star, X,
} from 'lucide-react';
import { items, families, categories, modalities, stats, searchItems, formatCount, type Item } from '../lib/catalog';
import { Arena } from '../components/Arena';
import { LocalStudio } from '../components/LocalStudio';
import { AtlasChat } from '../components/AtlasChat';
import { Documents } from '../components/Documents';
import { ProjectDetail } from '../components/ProjectDetail';
import { compactLicense, deploymentTask, downloadText, Modal, RepoImage } from '../components/AtlasUI';

type Page = 'explore' | 'arena' | 'docs' | 'local' | 'saved';
type Kind = 'tool' | 'model';
const destinations: [Page, string][] = [['explore', '探索'], ['arena', 'Arena'], ['local', '本地部署'], ['docs', '文档']];
const favoriteOrder = ['three-js', 'remotion', 'godot', 'impeccable', 'comfyui', 'blender', 'tldraw', 'dify', 'astro', 'n8n', 'ghidra', 'playwright'];
const blankCommunity = { score: null, stars: null, voters: 0, informationN: 0, status: 'unrated', lower95: null, upper95: null };
const recipeFor = (item: Item) => /open-webui/i.test(item.id) ? 'open-webui' : /^n8n$/.test(item.id) ? 'n8n' : /qdrant/.test(item.id) ? 'qdrant' : null;

export default function Atlas() {
  const [page, setPage] = useState<Page>('explore');
  const [kind, setKind] = useState<Kind>('tool');
  const [family, setFamily] = useState('all');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('curated');
  const [view, setView] = useState('grid');
  const [limit, setLimit] = useState(18);
  const [saved, setSaved] = useState<string[]>([]);
  const [compare, setCompare] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [selected, setSelected] = useState<Item | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPrefill, setChatPrefill] = useState('');
  const [toast, setToast] = useState('');
  const [identity, setIdentity] = useState<unknown>(null);
  const [community, setCommunity] = useState<Record<string, any>>({});
  const [communityReady, setCommunityReady] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [license, setLicense] = useState('all');
  const [localRecipe, setLocalRecipe] = useState<string | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem('vibe-atlas:saved') || '[]');
      if (Array.isArray(stored)) setSaved(stored.filter(id => typeof id === 'string' && items.some(item => item.id === id)));
    } catch { /* A blocked or invalid local store must not prevent browsing. */ }
    fetch('/api/community').then(async response => {
      if (!response.ok) throw new Error('Community unavailable');
      return response.json();
    }).then((data: any) => {
      setIdentity(data.identity || null); setCommunity(data.scores || {}); setCommunityReady(true);
    }).catch(() => setCommunityReady(false));
    const id = new URLSearchParams(location.search).get('item');
    if (id) setSelected(items.find(item => item.id === id) || null);
  }, []);

  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileMenu(false);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setPage('explore');
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    }
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => { setLimit(18); }, [kind, family, category, query, sort, license, page]);

  function toggleSave(id: string) {
    setSaved(previous => {
      const next = previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id];
      try { localStorage.setItem('vibe-atlas:saved', JSON.stringify(next)); }
      catch { setToast('收藏已保留在当前页面；浏览器未允许持久保存。'); }
      return next;
    });
  }
  function openItem(item: Item) {
    setSelected(item);
    const url = new URL(location.href); url.searchParams.set('item', item.id); history.replaceState(null, '', url);
  }
  function closeItem() {
    setSelected(null);
    const url = new URL(location.href); url.searchParams.delete('item'); history.replaceState(null, '', url);
  }
  function navigate(destination: Page) {
    setMobileMenu(false);
    if (destination === 'saved') { setFamily('all'); setCategory('all'); setQuery(''); setLicense('all'); }
    setPage(destination); window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function ask(text = '') { setChatPrefill(text); setChatOpen(true); }
  function chooseKind(next: Kind) { setKind(next); setFamily('all'); setCategory('all'); }
  function toggleCompare(id: string) {
    if (compare.includes(id)) setCompare(previous => previous.filter(value => value !== id));
    else if (compare.length < 3) setCompare(previous => [...previous, id]);
    else setToast('一次最多对比 3 个项目。');
  }

  const pool = useMemo(() => {
    let list = items.filter(item => item.kind === kind && (page !== 'saved' || saved.includes(item.id)));
    if (family !== 'all' && page !== 'saved') list = list.filter(item => item.kind === 'model' ? item.modalities.includes(family) : item.familyId === family);
    if (category !== 'all') list = list.filter(item => item.categoryId === category);
    if (license === 'permissive') list = list.filter(item => /MIT|Apache|BSD|ISC/.test(item.license) &&
      (item.kind === 'tool' ? item.licenseClass === 'open-source' : item.licenseClass === 'permissive-open-weights'));
    if (license === 'review') list = list.filter(item => /restricted|research|mixed|review|code-open|source-available/.test(item.licenseClass));
    list = searchItems(query, list);
    if (sort === 'heat') list.sort((a, b) => (b.popularity.score ?? -1) - (a.popularity.score ?? -1));
    if (sort === 'stars') list.sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1));
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'community') list.sort((a, b) => (community[b.id]?.rankScore ?? -1) - (community[a.id]?.rankScore ?? -1));
    if (sort === 'curated' && !query) list.sort((a, b) => {
      const ai = favoriteOrder.indexOf(a.id), bi = favoriteOrder.indexOf(b.id);
      return (ai < 0 ? 1000 : ai) - (bi < 0 ? 1000 : bi);
    });
    return list;
  }, [kind, page, saved, family, category, query, sort, license, community]);

  const counts = (id: string) => items.filter(item => kind === 'model' ? item.kind === 'model' && item.modalities.includes(id) : item.kind === 'tool' && item.familyId === id).length;
  const tabCount = (tabKind: Kind) => page === 'saved' ? items.filter(item => item.kind === tabKind && saved.includes(item.id)).length : tabKind === 'tool' ? stats.tools : stats.models;
  const catalogTitle = page === 'saved' ? '已收藏' : query ? '搜索结果' : family === 'all' ?
    (sort === 'curated' ? '精选项目' : kind === 'tool' ? '全部工具' : '全部模型') :
    (kind === 'tool' ? families.find(value => value.id === family)?.name : modalities.find(value => value.id === family)?.label);

  return <>
    <a className="skip-link" href="#main-content">跳到内容</a>
    <header className="site-header">
      <div className="nav-inner">
        <button className="brand" onClick={() => navigate('explore')} aria-label="Vibe Atlas 首页">
          <svg viewBox="0 0 28 28" aria-hidden="true"><path d="M3 5l11 19L25 5M8 5l6 10L20 5" /></svg><span>Vibe Atlas</span>
        </button>
        <nav aria-label="主导航">{destinations.map(([destination, label]) => <button key={destination}
          className={page === destination ? 'active' : ''} aria-current={page === destination ? 'page' : undefined}
          onClick={() => navigate(destination)}>{label}</button>)}</nav>
        <div className="nav-right">
          <button className={`icon-button ${page === 'saved' ? 'selected' : ''}`} onClick={() => navigate('saved')}
            aria-label={`我的收藏，${saved.length} 个项目`}><Bookmark size={20} fill={page === 'saved' ? 'currentColor' : 'none'} /></button>
          <button className="button small dark" onClick={() => { setMobileMenu(false); ask(); }} aria-label="问 Atlas">
            <MessageCircle size={17} /><span>问 Atlas</span>
          </button>
          <button className="icon-button mobile-menu-toggle" onClick={() => setMobileMenu(value => !value)}
            aria-label={mobileMenu ? '关闭导航菜单' : '打开导航菜单'} aria-expanded={mobileMenu} aria-controls="mobile-navigation">
            {mobileMenu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {mobileMenu && <nav className="mobile-navigation" id="mobile-navigation" aria-label="手机导航">
          {[...destinations, ['saved', '我的收藏'] as [Page, string]].map(([destination, label]) => <button key={destination}
            className={page === destination ? 'active' : ''} onClick={() => navigate(destination)}>{label}<ArrowUpRight size={17} /></button>)}
        </nav>}
      </div>
    </header>

    <main id="main-content">
      {(page === 'explore' || page === 'saved') && <>
        <section className="hero page-width">
          <h1>{page === 'saved' ? '我的收藏' : kind === 'tool' ? '探索创作工具' : '探索本地模型'}</h1>
          <form className="hero-search" onSubmit={event => {
            event.preventDefault(); document.getElementById('directory')?.scrollIntoView({ behavior: 'smooth' });
          }}>
            <Search size={21} />
            <input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)}
              placeholder={kind === 'tool' ? '搜索工具名称或任务' : '搜索模型名称或任务'} aria-label="搜索目录" />
            {query ? <button type="button" className="icon-button" onClick={() => setQuery('')} aria-label="清除搜索"><X size={18} /></button> : <kbd>⌘ K</kbd>}
            <button className="search-go" aria-label="搜索"><ArrowRight size={20} /></button>
          </form>
        </section>

        <section id="directory" className="directory page-width">
          <div className="directory-top">
            <div className="segmented" aria-label="目录类型">
              <button className={kind === 'tool' ? 'active' : ''} aria-pressed={kind === 'tool'} onClick={() => chooseKind('tool')}>创作工具<span>{tabCount('tool')}</span></button>
              <button className={kind === 'model' ? 'active' : ''} aria-pressed={kind === 'model'} onClick={() => chooseKind('model')}>本地模型<span>{tabCount('model')}</span></button>
            </div>
            {kind === 'model' && <button className="text-link directory-arena" onClick={() => navigate('arena')}>盲测 Arena<ArrowUpRight size={16} /></button>}
          </div>
          <div className={`directory-layout ${page === 'saved' ? 'without-sidebar' : ''}`}>
            {page !== 'saved' && <aside className="category-sidebar" aria-label="目录分类">
              <h2 className="sidebar-heading">分类</h2>
              <button className={`category ${family === 'all' ? 'active' : ''}`} aria-pressed={family === 'all'}
                onClick={() => { setFamily('all'); setCategory('all'); }}><span>全部</span><small>{kind === 'tool' ? stats.tools : stats.models}</small></button>
              {(kind === 'tool' ? families : modalities).map((entry: any) => <div key={entry.id}>
                <button className={`category ${family === entry.id ? 'active' : ''}`} aria-pressed={family === entry.id}
                  onClick={() => { setFamily(entry.id); setCategory('all'); }}><span>{entry.name || entry.label}</span><small>{counts(entry.id)}</small></button>
                {kind === 'tool' && family === entry.id && <div className="subcategories">
                  {categories.filter(value => value.familyId === entry.id).map(value => <button key={value.id}
                    className={category === value.id ? 'active' : ''} aria-pressed={category === value.id}
                    onClick={() => setCategory(category === value.id ? 'all' : value.id)}>{value.name}</button>)}
                </div>}
              </div>)}
            </aside>}
            <div className="catalog-main">
              {kind === 'tool' && family !== 'all' && page !== 'saved' && <label className="mobile-branch-filter">
                <span className="sr-only">选择工具分支</span>
                <select aria-label="选择工具分支" value={category} onChange={event => setCategory(event.target.value)}>
                  <option value="all">全部分支</option>{categories.filter(value => value.familyId === family).map(value => <option key={value.id} value={value.id}>{value.name}</option>)}
                </select>
              </label>}
              <div className="catalog-toolbar">
                <div className="catalog-heading"><h2>{catalogTitle}</h2><span className="result-count" aria-label={`${pool.length} 个项目`}>{pool.length}</span></div>
                <div className="toolbar-actions">
                  <label className="sort-select"><span className="sr-only">排序方式</span>
                    <select value={sort} onChange={event => setSort(event.target.value)}>
                      <option value="curated">精选</option><option value="heat">仓库热度</option><option value="stars">GitHub Stars</option>
                      <option value="community">社区置信下界</option><option value="name">名称 A–Z</option>
                    </select><ChevronDown size={16} />
                  </label>
                  <button className={`icon-button ${filtersOpen ? 'selected' : ''}`} aria-label="筛选许可" aria-expanded={filtersOpen}
                    onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={19} /></button>
                  <div className="view-switch" role="group" aria-label="目录视图">
                    <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="卡片视图" aria-pressed={view === 'grid'}><LayoutGrid size={18} /></button>
                    <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="列表视图" aria-pressed={view === 'list'}><List size={19} /></button>
                  </div>
                </div>
              </div>
              {filtersOpen && <div className="filter-row"><label htmlFor="license-filter">许可</label>
                <select id="license-filter" value={license} onChange={event => setLicense(event.target.value)}>
                  <option value="all">全部许可</option><option value="permissive">MIT / Apache / BSD 等宽松许可</option><option value="review">需核对许可或条款</option>
                </select>
                <button className="text-link" onClick={() => { setLicense('all'); setFamily('all'); setCategory('all'); setQuery(''); }}>重置</button>
              </div>}
              {pool.length > 0 ? <div className={`project-grid ${view === 'list' ? 'list-view' : ''}`}>
                {pool.slice(0, limit).map(item => <article className="project-card" key={item.id}>
                  <button className="project-visual" onClick={() => openItem(item)} aria-label={`查看 ${item.name}`}><RepoImage item={item} /></button>
                  <div className="project-content">
                    <div className="card-title">
                      <button onClick={() => openItem(item)}><h3>{item.name}</h3></button>
                      <button className={`icon-button save-button ${saved.includes(item.id) ? 'saved' : ''}`} onClick={() => toggleSave(item.id)}
                        aria-label={saved.includes(item.id) ? `取消收藏 ${item.name}` : `收藏 ${item.name}`} aria-pressed={saved.includes(item.id)}>
                        <Bookmark size={18} fill={saved.includes(item.id) ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                    <p className="project-description">{item.description}</p>
                    <div className="project-tags"><span>{item.category}</span>
                      {item.kind === 'model' ? <span className={/restricted|research|mixed/.test(item.licenseClass) ? 'license-restricted' : ''}>
                        {/restricted|research|mixed/.test(item.licenseClass) ? '许可有限制' : item.licenseClass === 'permissive-open-weights' ? '宽松权重许可' : '权重待核对'}
                      </span> : <span>{compactLicense(item)}</span>}
                    </div>
                    <div className="card-bottom">
                      <button className="heat" onClick={() => openItem(item)} title="查看仓库热度与数据覆盖率">热度<strong>{item.popularity.score === null ? '—' : item.popularity.score.toFixed(1)}</strong></button>
                      <a href={item.github} target="_blank" rel="noreferrer" className="star-count"
                        title={`${item.starsApproximate ? '近似' : '实际'} GitHub Stars · ${item.observedAt || '待采集'}`}>
                        <Star size={15} />{item.starsApproximate ? '≈' : ''}{formatCount(item.stars)}
                      </a>
                      <button className={`compare-add ${compare.includes(item.id) ? 'selected' : ''}`} onClick={() => toggleCompare(item.id)}
                        aria-label={compare.includes(item.id) ? `移除 ${item.name} 对比` : `加入 ${item.name} 对比`} aria-pressed={compare.includes(item.id)}>
                        {compare.includes(item.id) ? <Check size={18} /> : <Plus size={18} />}
                      </button>
                    </div>
                    {community[item.id]?.voters > 0 && <div className="community-mini">{community[item.id].stars?.toFixed(2)} / 5 · {community[item.id].voters} 人评价</div>}
                  </div>
                </article>)}
              </div> : <div className="empty-state">
                <h3>{page === 'saved' ? '暂无收藏' : '没有匹配的项目'}</h3>
                <button className="button outline" onClick={() => page === 'saved' ? navigate('explore') : ask(query)}>
                  {page === 'saved' ? '探索项目' : '问 Atlas'}<ArrowRight size={17} />
                </button>
              </div>}
              {limit < pool.length && <div className="load-more"><button className="button outline" onClick={() => setLimit(value => value + 24)}>
                加载更多<ChevronDown size={17} />
              </button></div>}
            </div>
          </div>
        </section>
      </>}
      {page === 'arena' && <Arena onOpen={openItem} identity={identity} notify={setToast} />}
      {page === 'docs' && <Documents />}
      {page === 'local' && <LocalStudio initialRecipe={localRecipe} notify={setToast} />}
    </main>

    <footer className="site-footer page-width"><span>Vibe Atlas</span><div><button onClick={() => navigate('docs')}>文档</button><a href="/api/catalog?download=1">下载目录</a></div></footer>
    {compare.length > 0 && <div className="compare-dock">
      <span><Scale size={19} />{compare.length} 个项目</span>
      <button className="text-link" onClick={() => setCompare([])}>清空</button>
      <button className="button primary" onClick={() => setComparing(true)}>对比<ArrowRight size={17} /></button>
    </div>}
    {!chatOpen && <button className="chat-fab" onClick={() => ask()} aria-label="打开 Atlas 检索助手"><MessageCircle size={22} /></button>}
    {selected && <ProjectDetail key={selected.id} item={selected} onClose={closeItem} saved={saved.includes(selected.id)}
      toggleSave={() => toggleSave(selected.id)} identity={identity} communityReady={communityReady}
      score={community[selected.id] || blankCommunity} onVote={score => setCommunity(previous => ({ ...previous, [selected.id]: score }))}
      onDeploy={() => {
        setLocalRecipe(recipeFor(selected)); downloadText(`${selected.id}-codex-task.md`, deploymentTask(selected));
        closeItem(); navigate('local'); setToast('部署任务已下载。');
      }}
      ask={() => { const name = selected.name; closeItem(); ask(`帮我判断 ${name} 的硬件与许可是否适合本地部署`); }} notify={setToast} />}
    {comparing && <Modal title="项目对比" onClose={() => setComparing(false)} wide>
      <div className="comparison"><div className="table-scroll"><table>
        <thead><tr><th>项目</th>{compare.map(id => <th key={id}>{items.find(item => item.id === id)?.name}</th>)}</tr></thead>
        <tbody>{['用途', '分类', '许可证', '仓库热度', 'GitHub Stars', '硬件条件', '说明'].map(label => <tr key={label}>
          <th>{label}</th>{compare.map(id => {
            const item = items.find(value => value.id === id)!;
            return <td key={id}>{label === '用途' ? item.description : label === '分类' ? item.category : label === '许可证' ? item.license :
              label === '仓库热度' ? `${item.popularity.score?.toFixed(1) ?? '—'} / 100` : label === 'GitHub Stars' ? `${item.starsApproximate ? '≈' : ''}${formatCount(item.stars)}` :
              label === '硬件条件' ? item.hardwareNote : <a className="text-link" href={`/docs/projects/${item.id}.md`} download>项目说明.md<ArrowRight size={16} /></a>}</td>;
          })}
        </tr>)}</tbody>
      </table></div></div>
    </Modal>}
    {chatOpen && <AtlasChat prefill={chatPrefill} onClose={() => setChatOpen(false)} onOpen={openItem}
      onLocal={() => { setChatOpen(false); navigate('local'); }} />}
    {toast && <div className="toast" role="status"><span>{toast}</span><button onClick={() => setToast('')} aria-label="关闭提示"><X size={18} /></button></div>}
  </>;
}
