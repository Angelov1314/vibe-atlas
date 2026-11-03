/** Rebuild public Markdown from the editable sources. No network or credentials. */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicDocs = path.join(root, 'public/docs');
const projectDocs = path.join(publicDocs, 'projects');
await mkdir(projectDocs, { recursive: true });

// Markdown downloads need their contents, not filesystem clone metadata. Reading
// and writing avoids slow native copy operations in cloud-synced macOS folders.
const copyMarkdown = async (source, destination) =>
  writeFile(destination, await readFile(source, 'utf8'), 'utf8');

for (const entry of await readdir(path.join(root, 'docs'), { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.md')) {
    await copyMarkdown(path.join(root, 'docs', entry.name), path.join(publicDocs, entry.name));
  }
}
await copyMarkdown(path.join(root, 'DESIGN.md'), path.join(publicDocs, 'DESIGN.md'));
await copyMarkdown(path.join(root, 'docs', 'ranking-policy.md'), path.join(root, 'public/downloads/RANKING_POLICY.md'));

const catalog = JSON.parse(await readFile(path.join(root, 'data/catalog.json'), 'utf8'));
const modelCatalog = JSON.parse(await readFile(path.join(root, 'data/models.json'), 'utf8'));
const text = value => value == null ? '待核验' : typeof value === 'string' ? value : JSON.stringify(value, null, 2);
const code = value => ['```json', JSON.stringify(value, null, 2), '```'].join('\n');
const lookup = (list, id) => list.find(entry => entry.id === id);
const index = ['# 项目说明索引', '', '由目录原始数据生成；请修改 data/ 中的来源，随后运行 pnpm docs:prepare。', ''];

for (const [kind, projects] of [['tool', catalog.projects], ['model', modelCatalog.models]]) {
  index.push(`## ${kind === 'tool' ? '创作工具' : '本地模型'}`, '');
  for (const project of projects) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(project.id)) throw new Error(`Unsafe project document ID: ${project.id}`);
    const isModel = kind === 'model';
    const sources = (isModel ? project.sources : project.sourceUrls) || [project.github];
    const sourceLinks = sources.map(source => typeof source === 'string' ? source : source.url).filter(Boolean);
    const category = isModel
      ? (project.modalities || []).map(id => lookup(modelCatalog.modalities, id)?.label || id).join(' / ')
      : lookup(catalog.categories, project.categoryId)?.name || project.categoryId;
    const license = isModel ? project.license?.weights || project.license?.code : project.license;
    const licenseNote = isModel ? project.license?.summary : project.licenseNote;
    const observed = project.starsObservedAt || project.verifiedAt || project.researchDate || modelCatalog.researchedAt;
    const install = isModel ? project.deploy?.commandHint : project.deploy?.installHint;
    const content = [
      `# ${project.name}`, '', project.description, '',
      '## 项目信息', '',
      `- 类型：${isModel ? '本地模型' : '创作工具'}`,
      `- 分类：${category}`,
      `- GitHub：${project.github || '待核验'}`,
      `- 官网：${project.homepage || project.github || '待核验'}`,
      `- 代码许可：${text(isModel ? project.license?.code : license)}`,
      ...(isModel ? [`- 权重许可：${text(license)}`, `- 权重分类：${text(project.license?.classification)}`] : []),
      '', '## 许可说明', '', text(licenseNote || '使用前核对当前版本 LICENSE、依赖和数据来源。'),
      '', '## 本地部署', '', text(install), '',
      '以上是官方安装方向，不代表已在本机执行或验证。详情页可下载包含完整检查步骤的 Codex 部署任务。',
      '', '## 硬件条件', '', text(project.hardware?.notes || '依项目、工作负载和运行方式而定；未在用户设备上实测。'),
      ...(isModel && typeof project.hardware?.vramGb === 'number' ? ['', `参考显存：${project.hardware.vramGb} GB；仍受版本、精度和工作流影响。`] : []),
      ...(project.notes ? ['', '## 项目补充', '', text(project.notes)] : []),
      '', '## 数据快照', '',
      `- GitHub Stars：${project.stars == null ? '待采集' : `${project.starsApproximate ? '约 ' : ''}${project.stars}`}`,
      `- 采集时间：${text(observed)}`,
      `- 最近推送：${text(project.lastPushedAt || project.githubMetadata?.pushedAt)}`,
      '- X：尚未接入完整授权观察窗口。',
      '', '起始热度依据已有仓库指标；缺失信号不补造。模型变体可共享同一仓库星数。热度不能解释为质量榜或全网第一。评分权重、覆盖率、社区后验与风控见评分政策。',
      '', '## 图片与归属', '',
      `- 展示图：${project.previewImage}`,
      `- 来源：${project.imageSource || project.previewSource || project.github}`,
      `- 归属：${project.imageAttribution || `${project.name} 官方项目 / 仓库`}`,
      `- 图片说明：${project.previewAlt || '官方项目展示或仓库社交预览，非本站 Arena 评测样本。'}`,
      '', '## 可追溯来源', '', ...sourceLinks.map(source => `- ${source}`),
      '', '## 原始记录', '', code(project), '',
    ].join('\n');
    await writeFile(path.join(projectDocs, `${project.id}.md`), content, 'utf8');
    index.push(`- [${project.name}](projects/${project.id}.md)：${project.description}`);
  }
  index.push('');
}
await writeFile(path.join(publicDocs, 'PROJECTS.md'), index.join('\n'), 'utf8');
console.log(`Prepared Markdown: ${catalog.projects.length + modelCatalog.models.length} project documents plus guides.`);
