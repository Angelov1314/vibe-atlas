import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';

const catalog = JSON.parse(readFileSync('data/catalog.json', 'utf8'));
const modelCatalog = JSON.parse(readFileSync('data/models.json', 'utf8'));
assert(catalog.categories.length >= 50);
assert(catalog.projects.length >= 50);
assert(modelCatalog.models.length >= 30);

const uniqueById = (values, label) => {
  const ids = new Set();
  for (const value of values) {
    assert(typeof value.id === 'string' && value.id.trim(), `${label} has an empty id`);
    assert(!ids.has(value.id), `Duplicate ${label} id: ${value.id}`);
    ids.add(value.id);
  }
  return ids;
};

const canonicalGitHubRepo = (value, label) => {
  assert(typeof value === 'string', `${label} is missing its repository URL`);
  const url = new URL(value);
  assert.equal(url.protocol, 'https:', `${label} must use HTTPS`);
  assert.equal(url.hostname.toLowerCase(), 'github.com', `${label} must point to GitHub`);
  const path = url.pathname.replace(/\/+$/, '').replace(/\.git$/i, '');
  const parts = path.split('/').filter(Boolean);
  assert.equal(parts.length, 2, `${label} must identify one GitHub repository`);
  return `${url.hostname.toLowerCase()}/${parts.join('/').toLowerCase()}`;
};

const familyIds = uniqueById(catalog.families, 'family');
const categoryIds = uniqueById(catalog.categories, 'category');
const itemIds = uniqueById([...catalog.projects, ...modelCatalog.models], 'item');
const categoryById = new Map(catalog.categories.map(category => [category.id, category]));
const categoryCounts = new Map([...categoryIds].map(id => [id, 0]));
const toolRepos = new Set();

for (const project of catalog.projects) {
  assert(familyIds.has(project.familyId), `${project.id} has unknown familyId: ${project.familyId}`);
  const category = categoryById.get(project.categoryId);
  assert(category, `${project.id} has unknown categoryId: ${project.categoryId}`);
  assert.equal(category.familyId, project.familyId,
    `${project.id} category ${project.categoryId} belongs to ${category.familyId}, not ${project.familyId}`);
  categoryCounts.set(project.categoryId, categoryCounts.get(project.categoryId) + 1);
  assert(Array.isArray(project.tags) && project.tags.some(tag => typeof tag === 'string' && tag.trim()),
    `${project.id} needs at least one non-empty tag`);

  const repo = canonicalGitHubRepo(project.github, `${project.id}.github`);
  assert(!toolRepos.has(repo), `Duplicate tool repository: ${repo}`);
  toolRepos.add(repo);
}

for (const category of catalog.categories) {
  assert(familyIds.has(category.familyId), `${category.id} has unknown familyId: ${category.familyId}`);
  assert(typeof category.name === 'string' && category.name.trim(), `${category.id} has no display name`);
  assert(categoryCounts.get(category.id) > 0, `${category.id} has no projects`);
}

for (const [label, item] of [...catalog.projects.map(item => ['project', item]), ...modelCatalog.models.map(item => ['model', item])]) {
  assert(typeof item.description === 'string' && item.description.trim().length > 8,
    `${item.id} (${label}) needs a useful description`);
  if (item.previewImage?.startsWith('/assets/')) {
    assert(existsSync(`public${item.previewImage}`), `${item.id} references missing local preview ${item.previewImage}`);
  } else {
    assert(typeof item.previewImage === 'string' && item.previewImage.startsWith('https://'),
      `${item.id} has invalid previewImage`);
  }
  assert(item.stars === null || (Number.isFinite(item.stars) && item.stars >= 0), `${item.id} has invalid stars`);
}

const modalityIds = uniqueById(modelCatalog.modalities, 'modality');
for (const model of modelCatalog.models) {
  assert(model.arena.score === null, `${model.id} must start without an Arena score`);
  assert(model.arena.votes === 0, `${model.id} must start without Arena votes`);
  assert(model.license.code, `${model.id} needs an explicit code license classification`);
  assert(model.license.classification, `${model.id} needs an explicit license classification`);
  assert(Array.isArray(model.modalities) && model.modalities.length > 0, `${model.id} needs at least one modality`);
  for (const id of model.modalities) assert(modalityIds.has(id), `${model.id} has unknown modality: ${id}`);
  if (model.github) canonicalGitHubRepo(model.github, `${model.id}.github`);
}

console.log(JSON.stringify({
  tools: catalog.projects.length,
  branches: catalog.categories.length,
  populatedBranches: [...categoryCounts.values()].filter(count => count > 0).length,
  models: modelCatalog.models.length,
  modalities: modelCatalog.modalities.length,
  uniqueItems: itemIds.size,
  uniqueToolRepositories: toolRepos.size,
  status: 'validated',
}));
