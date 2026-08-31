import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

import { labelsFrom, listIssues, rowFrom, rowsFrom } from '../issues.mjs';

// What can be proved here, and what cannot.
//
// **Atlas is not imported and never will be.** A plugin that tested itself
// against Atlas's own reader would be a plugin whose tests pass on one build and
// say nothing about any other. What these hold instead are the rules read out of
// Atlas's source and written down here in full — every one of them refuses this
// plugin at install if it is broken, so a failure here is a failure there.
//
// **What is not proved here is that it installs and runs.** That takes a person,
// a running Atlas, a GitHub connection and a token, and nothing in this folder
// can stand in for it.

const readManifest = async () =>
  JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));

/** Everything a manifest may carry — `manifestFields` in Atlas's reader. */
const manifestFields = ['plugin', 'named', 'runs', 'host', 'requires', 'calls', 'contributes'];
/** The three that must be there, and the cap every plugin-authored name is under. */
const mustHave = ['plugin', 'named', 'runs'];
const longestName = 80;
/** Everything a declared call may carry, and the methods Atlas will send. */
const callFields = ['call', 'method', 'path', 'fills', 'label'];
const methodsOffered = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];
/** The two placeholders Atlas fills, which no `fills` entry may name. */
const placeholdersFilled = ['owner', 'repository'];
/** A name a call or a parameter may have. */
const aPlainName = /^[A-Za-z0-9_-]+$/;
/** An identity, which names a folder on this machine. */
const aPlainIdentity = /^[a-z0-9-]+$/;
/** The closed vocabularies a screen is checked against before `Hosts C3b`. */
const screenFields = ['screen', 'named', 'under', 'rows', 'holds'];
const placesOffered = ['repository'];
const componentFields = { filterBar: 'filters', rowList: 'columns' };
const componentTakes = {
  filterBar: ['state', 'labels'],
  rowList: ['number', 'title', 'state', 'labels'],
};

test('the manifest is JSON and is a set of fields', async () => {
  const manifest = await readManifest();
  assert.equal(typeof manifest, 'object');
  assert.ok(manifest !== null && !Array.isArray(manifest));
});

test('it carries no field Atlas does not know, and the three it must', async () => {
  const manifest = await readManifest();
  for (const field of Object.keys(manifest)) {
    assert.ok(manifestFields.includes(field), `${field} is not a field Atlas knows`);
  }
  for (const field of mustHave) {
    assert.equal(typeof manifest[field], 'string');
    assert.notEqual(manifest[field], '');
    assert.ok(manifest[field].length <= longestName);
  }
});

test('the identity is a name a folder can have', async () => {
  const manifest = await readManifest();
  assert.match(manifest.plugin, aPlainIdentity);
  assert.equal(manifest.plugin, 'issues');
});

test('it names the host it needs, and it is one Atlas has', async () => {
  const manifest = await readManifest();
  assert.equal(manifest.host, 'github');
});

test('it declares no verb, absent rather than empty', async () => {
  const manifest = await readManifest();
  assert.ok(!('requires' in manifest));
});

test('the entry file it names is committed beside the manifest', async () => {
  const manifest = await readManifest();
  assert.equal(manifest.runs, 'issues.mjs');
  assert.ok(!manifest.runs.includes('..'));
  const source = await readFile(new URL(`../${manifest.runs}`, import.meta.url), 'utf8');
  assert.ok(source.length > 0);
});

test('it declares exactly one call, and it is a read', async () => {
  const { calls } = await readManifest();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
  assert.ok(methodsOffered.includes(calls[0].method));
});

test('the call carries only fields Atlas knows, and a plain identifier', async () => {
  const [call] = (await readManifest()).calls;
  for (const field of Object.keys(call)) {
    assert.ok(callFields.includes(field), `${field} is not a field a call may carry`);
  }
  assert.match(call.call, aPlainName);
  assert.ok(call.call.length <= longestName);
  assert.equal(call.call, 'readIssues');
});

test('the path is rooted, anchored, and carries nothing in front of it', async () => {
  const [call] = (await readManifest()).calls;
  assert.equal(call.path, '/repos/{owner}/{repository}/issues');
  assert.ok(call.path.startsWith('/'));
  assert.ok(!call.path.startsWith('//'));
  assert.ok(!/^[A-Za-z][A-Za-z0-9+.-]*:/.test(call.path));
  assert.ok(!call.path.split('/').includes('..'));
  assert.ok(call.path.length <= longestName);
  const placeholders = [...call.path.matchAll(/\{([^{}]*)\}/g)].map((found) => found[1]);
  assert.deepEqual(placeholders, ['owner', 'repository']);
  for (const one of placeholdersFilled) {
    assert.ok(placeholders.includes(one));
  }
});

test('the area Atlas names from the path is issues', async () => {
  const [call] = (await readManifest()).calls;
  const segments = call.path.split('/').filter((one) => one !== '');
  const anchored = segments.findIndex((one) => one.includes('{repository}'));
  assert.equal(segments[anchored + 1], 'issues');
});

test('it fills state, labels and per_page, and never what Atlas fills', async () => {
  const [call] = (await readManifest()).calls;
  assert.deepEqual([...call.fills].sort(), ['labels', 'per_page', 'state']);
  for (const one of call.fills) {
    assert.match(one, aPlainName);
    assert.ok(one.length <= longestName);
    assert.ok(!placeholdersFilled.includes(one));
  }
});

test('the label is text, inside the cap, and is never what the call is named by', async () => {
  const [call] = (await readManifest()).calls;
  assert.equal(typeof call.label, 'string');
  assert.notEqual(call.label, '');
  assert.ok(call.label.length <= longestName);
  assert.notEqual(call.label, call.call);
});

test('the screen carries five fields, hangs under a repository, and lists rows', async () => {
  const { contributes } = await readManifest();
  assert.deepEqual(Object.keys(contributes), ['screens']);
  assert.equal(contributes.screens.length, 1);
  const [screen] = contributes.screens;
  assert.deepEqual(Object.keys(screen).sort(), [...screenFields].sort());
  for (const field of screenFields) {
    if (field === 'holds') {
      continue;
    }
    assert.equal(typeof screen[field], 'string');
    assert.notEqual(screen[field], '');
    assert.ok(screen[field].length <= longestName);
  }
  assert.ok(placesOffered.includes(screen.under));
  assert.ok(screen.holds.some((one) => one.component === 'rowList'));
});

test('the screen declares plain column and filter names, as commit A must', async () => {
  const [screen] = (await readManifest()).contributes.screens;
  for (const held of screen.holds) {
    const carries = componentFields[held.component];
    assert.ok(carries !== undefined, `${held.component} is not a component Atlas draws`);
    assert.deepEqual(Object.keys(held).sort(), ['component', carries].sort());
    assert.ok(Array.isArray(held[carries]) && held[carries].length > 0);
    for (const name of held[carries]) {
      // Plain names, and nothing else. A column written as a declaration —
      // a heading, a kind, an address template — refuses the plugin on the Atlas
      // this commit exists to be watched against.
      assert.equal(typeof name, 'string');
      assert.ok(componentTakes[held.component].includes(name), `${name} is not one Atlas has`);
    }
  }
  const rowList = screen.holds.find((one) => one.component === 'rowList');
  const filterBar = screen.holds.find((one) => one.component === 'filterBar');
  assert.deepEqual(rowList.columns, ['number', 'title', 'state', 'labels']);
  assert.deepEqual(filterBar.filters, ['state', 'labels']);
});

test('the export the screen names is the one the plugin has', async () => {
  const [screen] = (await readManifest()).contributes.screens;
  assert.equal(screen.rows, 'listIssues');
  assert.equal(typeof listIssues, 'function');
});

test('nothing in the plugin names an address, an owner or a repository', async () => {
  const source = await readFile(new URL('../issues.mjs', import.meta.url), 'utf8');
  assert.ok(!source.includes('https://'));
  assert.ok(!source.includes('http://'));
  assert.ok(!source.includes('api.github.com'));
  // The two segments Atlas fills are named nowhere: a message carrying either is
  // dropped by the channel as malformed before the gate ever sees it.
  assert.ok(!/['"`]owner['"`]/.test(source));
  assert.ok(!/['"`]repository['"`]/.test(source));
  // And nothing that belongs to whoever sends a request.
  for (const own of ['path', 'method', 'url', 'headers', 'query']) {
    assert.ok(!new RegExp(`['"\`]${own}['"\`]`).test(source), `${own} is the sender's`);
  }
});

/** An `atlas` handle that records what it was sent and answers with what it was given. */
function fakeAtlas(answer) {
  const sent = [];
  return {
    sent,
    handle: {
      send: (call, values, after) => {
        sent.push({ call, values, after });
        return Promise.resolve(answer);
      },
    },
  };
}

const anIssue = (over = {}) => ({
  number: 1,
  title: 'One',
  state: 'open',
  labels: [],
  body: 'not a column',
  user: { login: 'somebody' },
  ...over,
});

test('one call to the plugin makes one call to the host, under the declared name', async () => {
  const atlas = fakeAtlas({ body: [anIssue()], after: null });
  await listIssues({ atlas: atlas.handle, filters: { state: 'open', labels: [] }, after: null });
  assert.equal(atlas.sent.length, 1);
  assert.equal(atlas.sent[0].call, 'readIssues');
});

test('it fills state and per_page, and leaves labels off where there are none', async () => {
  const atlas = fakeAtlas({ body: [], after: null });
  await listIssues({ atlas: atlas.handle, filters: { state: 'closed', labels: [] }, after: null });
  assert.deepEqual(atlas.sent[0].values, { state: 'closed', per_page: 50 });
});

test('fifty is what it asks for', async () => {
  const atlas = fakeAtlas({ body: [], after: null });
  await listIssues({ atlas: atlas.handle, filters: { state: 'all', labels: [] }, after: null });
  assert.equal(atlas.sent[0].values.per_page, 50);
});

test('labels are one value, joined, never a second parameter', async () => {
  const atlas = fakeAtlas({ body: [], after: null });
  await listIssues({
    atlas: atlas.handle,
    filters: { state: 'open', labels: ['bug', 'x&state=all'] },
    after: null,
  });
  assert.deepEqual(atlas.sent[0].values, {
    state: 'open',
    per_page: 50,
    labels: 'bug,x&state=all',
  });
  assert.equal(Object.keys(atlas.sent[0].values).length, 3);
});

test('every name it sends is one the call declared', async () => {
  const { calls } = await readManifest();
  const atlas = fakeAtlas({ body: [], after: null });
  await listIssues({
    atlas: atlas.handle,
    filters: { state: 'open', labels: ['bug'] },
    after: null,
  });
  for (const name of Object.keys(atlas.sent[0].values)) {
    assert.ok(calls[0].fills.includes(name), `${name} is not a parameter the call declared`);
  }
});

test('where nobody asked for a state, it sends the default rather than leaving it off', async () => {
  const atlas = fakeAtlas({ body: [], after: null });
  await listIssues({ atlas: atlas.handle, filters: {}, after: null });
  assert.equal(atlas.sent[0].values.state, 'open');
});

test('the continuation is passed back unchanged, and handed on unread', async () => {
  const atlas = fakeAtlas({ body: [], after: 'a-second-one' });
  const answered = await listIssues({
    atlas: atlas.handle,
    filters: { state: 'open', labels: [] },
    after: 'the-one-atlas-minted',
  });
  assert.equal(atlas.sent[0].after, 'the-one-atlas-minted');
  assert.equal(answered.after, 'a-second-one');
});

test('a first page carries no continuation', async () => {
  const atlas = fakeAtlas({ body: [], after: null });
  await listIssues({ atlas: atlas.handle, filters: { state: 'open', labels: [] } });
  assert.equal(atlas.sent[0].after, null);
});

test("one of the door's named answers is left to Atlas, and nothing is said about it", async () => {
  const atlas = fakeAtlas({ answer: 'rateLimited', because: "Atlas's own sentence." });
  const answered = await listIssues({
    atlas: atlas.handle,
    filters: { state: 'open', labels: [] },
    after: null,
  });
  assert.deepEqual(answered, { rows: [], after: null });
});

test('a row holds exactly the four columns the screen declared', async () => {
  const atlas = fakeAtlas({ body: [anIssue()], after: null });
  const answered = await listIssues({
    atlas: atlas.handle,
    filters: { state: 'open', labels: [] },
    after: null,
  });
  assert.deepEqual(Object.keys(answered.rows[0]).sort(), [
    'labels',
    'number',
    'state',
    'title',
  ]);
});

test('a pull request is not an issue', () => {
  const rows = rowsFrom([
    anIssue({ number: 1 }),
    anIssue({ number: 2, pull_request: { url: 'somewhere' } }),
    anIssue({ number: 3 }),
  ]);
  assert.deepEqual(
    rows.map((one) => one.number),
    [1, 3],
  );
});

test('a pull request is dropped even where it carries nothing under that name', () => {
  assert.deepEqual(rowsFrom([anIssue({ pull_request: null })]), []);
});

test('the drop happens before the count, so a short page is not the last page', async () => {
  const body = Array.from({ length: 50 }, (unused, at) =>
    at < 20 ? anIssue({ number: at + 1, pull_request: {} }) : anIssue({ number: at + 1 }),
  );
  const atlas = fakeAtlas({ body, after: 'there-is-more' });
  const answered = await listIssues({
    atlas: atlas.handle,
    filters: { state: 'open', labels: [] },
    after: null,
  });
  assert.equal(answered.rows.length, 30);
  assert.equal(answered.after, 'there-is-more');
});

test('labels arrive sorted, however the host ordered them', () => {
  const one = rowFrom(anIssue({ labels: [{ name: 'bug' }, { name: 'agent' }] }));
  const other = rowFrom(anIssue({ labels: [{ name: 'agent' }, { name: 'bug' }] }));
  assert.deepEqual(one.labels, ['agent', 'bug']);
  assert.deepEqual(one.labels, other.labels);
});

test('a label written as a bare name is read too', () => {
  assert.deepEqual(labelsFrom(['two', 'one']), ['one', 'two']);
});

test('an issue with no labels has none rather than nothing', () => {
  assert.deepEqual(rowFrom(anIssue({ labels: undefined })).labels, []);
});

test('an item with no number fails the whole answer', () => {
  assert.throws(() => rowsFrom([anIssue(), anIssue({ number: undefined })]));
});

test('an item with a number that is not whole fails the whole answer', () => {
  assert.throws(() => rowsFrom([anIssue({ number: 1.5 })]));
});

test('an item with no title fails the whole answer', () => {
  assert.throws(() => rowsFrom([anIssue({ title: undefined })]));
});

test('a state the plugin has no word for fails the whole answer', () => {
  assert.throws(() => rowsFrom([anIssue({ state: 'merged' })]));
});

test('a label the plugin cannot read fails the whole answer', () => {
  assert.throws(() => rowsFrom([anIssue({ labels: [{ colour: 'red' }] })]));
  assert.throws(() => rowsFrom([anIssue({ labels: 'bug' })]));
});

test('an answer that is not a list of issues fails whole', () => {
  assert.throws(() => rowsFrom({ items: [] }));
  assert.throws(() => rowsFrom(null));
  assert.throws(() => rowsFrom([anIssue(), 'not an issue']));
});

test('a failing answer is a throw and never a shorter list', async () => {
  const atlas = fakeAtlas({ body: [anIssue(), anIssue({ title: undefined })], after: null });
  await assert.rejects(
    listIssues({ atlas: atlas.handle, filters: { state: 'open', labels: [] }, after: null }),
  );
});

test('it calls once and does not try again', async () => {
  const atlas = fakeAtlas({ body: [anIssue({ state: 'merged' })], after: null });
  await assert.rejects(
    listIssues({ atlas: atlas.handle, filters: { state: 'open', labels: [] }, after: null }),
  );
  assert.equal(atlas.sent.length, 1);
});

// The three checks that stand between this plugin and a screen, written out from
// Atlas's own source: the channel drops a message naming what belongs to the
// sender, the gate refuses a value the declaration did not name, and the door
// refuses a value it cannot put in a query. Then Atlas reads the rows back
// strictly against the columns the screen declared.

test('nothing it sends is dropped by the channel as malformed', async () => {
  const dropped = ['path', 'method', 'url', 'headers', 'query', 'owner', 'repository'];
  const atlas = fakeAtlas({ body: [], after: null });
  await listIssues({
    atlas: atlas.handle,
    filters: { state: 'open', labels: ['bug'] },
    after: null,
  });
  for (const name of dropped) {
    assert.ok(!(name in atlas.sent[0].values), `${name} belongs to whoever sends a request`);
  }
});

test('every value it sends is one the door can put in a query', async () => {
  const atlas = fakeAtlas({ body: [], after: null });
  await listIssues({
    atlas: atlas.handle,
    filters: { state: 'open', labels: ['bug', 'x&state=all'] },
    after: null,
  });
  const query = new URLSearchParams();
  for (const [named, one] of Object.entries(atlas.sent[0].values)) {
    assert.ok(['string', 'number', 'boolean'].includes(typeof one), `${named} cannot be carried`);
    query.set(named, String(one));
  }
  // Built the way the door builds it, so a label with an `&` in it is one label.
  assert.equal(new URLSearchParams(query.toString()).getAll('state').length, 1);
  assert.equal(new URLSearchParams(query.toString()).get('state'), 'open');
  assert.equal(new URLSearchParams(query.toString()).get('labels'), 'bug,x&state=all');
});

/** `rowsIn` and `rowIn` from Atlas's screen seam, for the four columns declared here. */
function atlasReadsRows(result, columns) {
  const isFields = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
  if (!isFields(result) || !Array.isArray(result.rows)) {
    return null;
  }
  const after = result.after;
  if (after !== undefined && after !== null && (typeof after !== 'string' || after.length > 200)) {
    return null;
  }
  const rows = [];
  for (const one of result.rows) {
    if (!isFields(one)) {
      return null;
    }
    for (const field of Object.keys(one)) {
      if (!columns.includes(field)) {
        return null;
      }
    }
    if (columns.includes('number') && (typeof one.number !== 'number' || !Number.isInteger(one.number))) {
      return null;
    }
    if (columns.includes('title') && typeof one.title !== 'string') {
      return null;
    }
    if (columns.includes('state') && !['open', 'closed'].includes(one.state)) {
      return null;
    }
    if (
      columns.includes('labels') &&
      !(Array.isArray(one.labels) && one.labels.every((name) => typeof name === 'string'))
    ) {
      return null;
    }
    rows.push(one);
  }
  return rows;
}

test('what it answers is what Atlas will draw, checked the way Atlas checks it', async () => {
  const [screen] = (await readManifest()).contributes.screens;
  const columns = screen.holds.find((one) => one.component === 'rowList').columns;
  const atlas = fakeAtlas({
    body: [
      anIssue({ number: 7, title: 'One', state: 'open', labels: [{ name: 'bug' }] }),
      anIssue({ number: 8, title: 'Two', state: 'closed', labels: ['agent', 'bug'] }),
      anIssue({ number: 9, pull_request: {} }),
    ],
    after: 'there-is-more',
  });
  const answered = await listIssues({
    atlas: atlas.handle,
    filters: { state: 'all', labels: [] },
    after: null,
  });
  const read = atlasReadsRows(answered, columns);
  assert.notEqual(read, null, 'Atlas would refuse this answer');
  assert.deepEqual(read, [
    { number: 7, title: 'One', state: 'open', labels: ['bug'] },
    { number: 8, title: 'Two', state: 'closed', labels: ['agent', 'bug'] },
  ]);
});

test('an empty answer is still one Atlas will draw', async () => {
  const [screen] = (await readManifest()).contributes.screens;
  const columns = screen.holds.find((one) => one.component === 'rowList').columns;
  const atlas = fakeAtlas({ answer: 'notFound', because: "Atlas's own sentence." });
  const answered = await listIssues({
    atlas: atlas.handle,
    filters: { state: 'open', labels: [] },
    after: null,
  });
  assert.deepEqual(atlasReadsRows(answered, columns), []);
});
