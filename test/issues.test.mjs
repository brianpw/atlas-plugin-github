import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

import { labelsAsked, labelsFrom, listIssues, rowFrom, rowsFrom } from '../issues.mjs';

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
/** The five fields a screen carries, and the one place it may hang under. */
const screenFields = ['screen', 'named', 'under', 'rows', 'holds'];
const placesOffered = ['repository'];
/** The two components Atlas draws, and the one field each carries beside its name. */
const componentFields = { filterBar: 'filters', rowList: 'columns' };
/** Everything a column, a filter and one value of a choice may carry. */
const columnFields = ['column', 'named', 'kind', 'values', 'opensAt'];
const filterFields = ['filter', 'named', 'kind', 'values', 'byDefault'];
const valueFields = ['value', 'named'];
/** The four shapes a column's value may be, and the two controls a filter draws as. */
const columnKinds = ['text', 'number', 'choice', 'texts'];
const filterKinds = ['choice', 'text'];
/** The two kinds whose value can make an address, and how many columns a row draws. */
const kindsThatOpen = ['text', 'number'];
const mostColumns = 4;
/** What an address template may name — the two Atlas fills, and the row's own. */
const placeholdersOnARow = ['owner', 'repository', 'value'];

/** The `rowList` a screen must hold, and the `filterBar` this one does. */
const rowListOf = (screen) => screen.holds.find((one) => one.component === 'rowList');
const filterBarOf = (screen) => screen.holds.find((one) => one.component === 'filterBar');

/** One choice's values: two fields each, both text, both inside the cap, none twice. */
function assertValues(values) {
  const already = new Set();
  for (const one of values) {
    assert.deepEqual(Object.keys(one).sort(), [...valueFields].sort());
    for (const field of valueFields) {
      assert.equal(typeof one[field], 'string');
      assert.notEqual(one[field], '');
      assert.ok(one[field].length <= longestName);
    }
    assert.ok(!already.has(one.value), `${one.value} is declared twice`);
    already.add(one.value);
  }
}

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

test('each component carries its own field and nothing else, and it is not empty', async () => {
  const [screen] = (await readManifest()).contributes.screens;
  for (const held of screen.holds) {
    const carries = componentFields[held.component];
    assert.ok(carries !== undefined, `${held.component} is not a component Atlas draws`);
    assert.deepEqual(Object.keys(held).sort(), ['component', carries].sort());
    assert.ok(Array.isArray(held[carries]) && held[carries].length > 0);
  }
});

// A column and a filter are declarations rather than names. A plain name is
// refused whole on the Atlas these commits exist to be watched against, and the
// refusal says so: *a column declares a name, a heading and a kind*.

test('the screen declares its columns, each with a name, a heading and a kind', async () => {
  const [screen] = (await readManifest()).contributes.screens;
  const { columns } = rowListOf(screen);
  assert.ok(columns.length >= 1 && columns.length <= mostColumns);
  const already = new Set();
  for (const column of columns) {
    assert.equal(typeof column, 'object');
    for (const field of Object.keys(column)) {
      assert.ok(columnFields.includes(field), `${field} is not a field a column may carry`);
    }
    for (const field of ['column', 'named', 'kind']) {
      assert.equal(typeof column[field], 'string', `a column needs a ${field}`);
      assert.notEqual(column[field], '');
      assert.ok(column[field].length <= longestName, `${field} is over the cap`);
    }
    assert.match(column.column, aPlainName);
    assert.ok(columnKinds.includes(column.kind), `${column.kind} is not a kind Atlas draws`);
    assert.ok(!already.has(column.column), `${column.column} is declared twice`);
    already.add(column.column);
  }
});

test('the columns are declared in the order the row draws them', async () => {
  const [screen] = (await readManifest()).contributes.screens;
  // Declaration order is slot order: the first fills the row's kind, the second
  // its name, the third its detail, the fourth its state. Declaring state third
  // would put the state marker in the detail slot, which is a moved screen
  // rather than the same one.
  assert.deepEqual(
    rowListOf(screen).columns.map((one) => one.column),
    ['number', 'title', 'labels', 'state'],
  );
  assert.deepEqual(
    rowListOf(screen).columns.map((one) => one.named),
    ['Issue', 'Title', 'Labels', 'State'],
  );
});

test('all four kinds Atlas draws are exercised, and values belong to a choice alone', async () => {
  const [screen] = (await readManifest()).contributes.screens;
  const { columns } = rowListOf(screen);
  assert.deepEqual(
    columns.map((one) => one.kind).sort(),
    [...columnKinds].sort(),
    'one column of each kind, so every shape Atlas draws is declared here',
  );
  for (const column of columns) {
    if (column.kind === 'choice') {
      assert.ok(Array.isArray(column.values) && column.values.length > 0);
      assertValues(column.values);
    } else {
      assert.ok(!('values' in column), `${column.column} carries values and is not a choice`);
    }
  }
});

test("the state column declares the plugin's own words for the two states an issue is in", async () => {
  const [screen] = (await readManifest()).contributes.screens;
  const state = rowListOf(screen).columns.find((one) => one.column === 'state');
  // GitHub's own words, kept as GitHub writes them, with English beside each.
  assert.deepEqual(state.values, [
    { value: 'open', named: 'Open' },
    { value: 'closed', named: 'Closed' },
  ]);
  // And they are the two the plugin will vouch for in a row it shapes.
  assert.deepEqual(rowFrom(anIssue({ state: 'open' })).state, 'open');
  assert.deepEqual(rowFrom(anIssue({ state: 'closed' })).state, 'closed');
});

test('the screen declares two filters: a choice with a default, and typed text', async () => {
  const [screen] = (await readManifest()).contributes.screens;
  const { filters } = filterBarOf(screen);
  const already = new Set();
  for (const filter of filters) {
    assert.equal(typeof filter, 'object');
    for (const field of Object.keys(filter)) {
      assert.ok(filterFields.includes(field), `${field} is not a field a filter may carry`);
    }
    for (const field of ['filter', 'named', 'kind']) {
      assert.equal(typeof filter[field], 'string', `a filter needs a ${field}`);
      assert.notEqual(filter[field], '');
      assert.ok(filter[field].length <= longestName, `${field} is over the cap`);
    }
    assert.match(filter.filter, aPlainName);
    assert.ok(filterKinds.includes(filter.kind), `${filter.kind} is not a control Atlas draws`);
    assert.ok(!already.has(filter.filter), `${filter.filter} is declared twice`);
    already.add(filter.filter);
  }
  assert.deepEqual(
    filters.map((one) => one.filter),
    ['state', 'labels'],
  );
});

test("open, closed and all are the plugin's words, and open is where a read starts", async () => {
  const [screen] = (await readManifest()).contributes.screens;
  const [state, labels] = filterBarOf(screen).filters;
  assert.equal(state.kind, 'choice');
  assertValues(state.values);
  assert.deepEqual(state.values, [
    { value: 'open', named: 'Open' },
    { value: 'closed', named: 'Closed' },
    { value: 'all', named: 'All' },
  ]);
  assert.equal(state.byDefault, 'open');
  assert.ok(
    state.values.some((one) => one.value === state.byDefault),
    'a default outside the values refuses the plugin',
  );
  // A field somebody types into starts empty, and a plugin putting words into one
  // nobody has typed in would be narrowing a list without being asked.
  assert.equal(labels.kind, 'text');
  assert.ok(!('byDefault' in labels));
  assert.ok(!('values' in labels));
});

test('the number column opens on the host, and it is the only column that does', async () => {
  const [screen] = (await readManifest()).contributes.screens;
  const { columns } = rowListOf(screen);
  const opening = columns.filter((one) => 'opensAt' in one);
  assert.equal(opening.length, 1, 'a row with two ways out is one a person must choose between');
  const [number] = opening;
  assert.equal(number.column, 'number');
  assert.ok(kindsThatOpen.includes(number.kind));
  const template = number.opensAt;
  assert.equal(typeof template, 'string');
  assert.ok(template.length <= longestName);
  // It is https, it writes its host plainly rather than composing one out of a
  // placeholder, and it names all three of what Atlas fills and nothing else.
  const found = /^https:\/\/([^/?#]+)/.exec(template);
  assert.notEqual(found, null, 'a template that is not https refuses the plugin');
  assert.ok(!found[1].includes('{') && !found[1].includes('}') && !found[1].includes('@'));
  const placeholders = [...template.matchAll(/\{([^{}]*)\}/g)].map((one) => one[1]);
  for (const one of placeholders) {
    assert.ok(placeholdersOnARow.includes(one), `Atlas does not fill {${one}}`);
  }
  for (const one of placeholdersOnARow) {
    assert.ok(placeholders.includes(one), `an address template names {${one}}`);
  }
  // And nothing in it is a repository, an owner or an issue number written down.
  assert.equal(template, 'https://github.com/{owner}/{repository}/issues/{value}');
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
  await listIssues({ atlas: atlas.handle, filters: { state: 'open', labels: '' }, after: null });
  assert.equal(atlas.sent.length, 1);
  assert.equal(atlas.sent[0].call, 'readIssues');
});

test('it fills state and per_page, and leaves labels off where there are none', async () => {
  const atlas = fakeAtlas({ body: [], after: null });
  await listIssues({ atlas: atlas.handle, filters: { state: 'closed', labels: '' }, after: null });
  assert.deepEqual(atlas.sent[0].values, { state: 'closed', per_page: 10 });
});

test('ten is what it asks for, because that is what fits through the channel', async () => {
  const atlas = fakeAtlas({ body: [], after: null });
  await listIssues({ atlas: atlas.handle, filters: { state: 'all', labels: '' }, after: null });
  assert.equal(atlas.sent[0].values.per_page, 10);
});

test('labels are one value, joined, never a second parameter', async () => {
  const atlas = fakeAtlas({ body: [], after: null });
  await listIssues({
    atlas: atlas.handle,
    filters: { state: 'open', labels: 'bug, x&state=all' },
    after: null,
  });
  assert.deepEqual(atlas.sent[0].values, {
    state: 'open',
    per_page: 10,
    labels: 'bug,x&state=all',
  });
  assert.equal(Object.keys(atlas.sent[0].values).length, 3);
});

test('every name it sends is one the call declared', async () => {
  const { calls } = await readManifest();
  const atlas = fakeAtlas({ body: [], after: null });
  await listIssues({
    atlas: atlas.handle,
    filters: { state: 'open', labels: 'bug' },
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

// **Every filter arrives as one line of text**, one per filter the screen
// declared, under the name it declared. Atlas checked that a chosen value is one
// the choice offers and knows nothing else about any of them; what a comma in a
// typed one means is this plugin's decision, and these are it.

test('it reads a read made the way Atlas makes one, from its own declaration', async () => {
  const [screen] = (await readManifest()).contributes.screens;
  // Built from the manifest rather than written out, so a filter added to the
  // declaration and not handled here fails this rather than passing quietly.
  const filters = Object.fromEntries(
    filterBarOf(screen).filters.map((one) => [one.filter, one.byDefault ?? '']),
  );
  for (const [named, one] of Object.entries(filters)) {
    assert.equal(typeof one, 'string', `${named} arrives as text`);
  }
  const atlas = fakeAtlas({ body: [], after: null });
  await listIssues({ atlas: atlas.handle, filters, after: null });
  assert.deepEqual(atlas.sent[0].values, { state: 'open', per_page: 10 });
});

test('the state it sends where nobody chose is the one the manifest defaults to', async () => {
  const [screen] = (await readManifest()).contributes.screens;
  const state = filterBarOf(screen).filters.find((one) => one.filter === 'state');
  const atlas = fakeAtlas({ body: [], after: null });
  await listIssues({ atlas: atlas.handle, filters: { state: '', labels: '' }, after: null });
  assert.equal(atlas.sent[0].values.state, state.byDefault);
});

test('a typed line of labels is split on the comma GitHub separates them by itself', () => {
  assert.deepEqual(labelsAsked('bug,agent'), ['bug', 'agent']);
  assert.deepEqual(labelsAsked('bug, agent'), ['bug', 'agent']);
  assert.deepEqual(labelsAsked('  bug ,  agent  '), ['bug', 'agent']);
  assert.deepEqual(labelsAsked('bug'), ['bug']);
});

test('an empty field and a stray comma ask for nothing rather than for a label of none', () => {
  assert.deepEqual(labelsAsked(''), []);
  assert.deepEqual(labelsAsked(','), []);
  assert.deepEqual(labelsAsked('   '), []);
  assert.deepEqual(labelsAsked('bug,,'), ['bug']);
});

test("a label whose own name holds a comma is out of reach, and the limit is GitHub's", () => {
  // GitHub allows a comma in a label name and its `labels` parameter offers no
  // escape for one, so a label called `needs, urgent` cannot be asked for by any
  // spelling: what arrives there is two names either way. An escape invented on
  // this side would be undone one line later, when the pieces are joined back
  // into the single value GitHub takes.
  assert.deepEqual(labelsAsked('needs, urgent'), ['needs', 'urgent']);
  // And the trade is stated rather than hidden: the label is out of reach of the
  // filter, and is still drawn in the Labels column of every row that carries it.
  assert.deepEqual(rowFrom(anIssue({ labels: [{ name: 'needs, urgent' }] })).labels, [
    'needs, urgent',
  ]);
});

test('a filter that is not text asks for nothing rather than failing the whole screen', () => {
  assert.deepEqual(labelsAsked(undefined), []);
  assert.deepEqual(labelsAsked(null), []);
  assert.deepEqual(labelsAsked(['bug']), []);
});

test('the continuation is passed back unchanged, and handed on unread', async () => {
  const atlas = fakeAtlas({ body: [], after: 'a-second-one' });
  const answered = await listIssues({
    atlas: atlas.handle,
    filters: { state: 'open', labels: '' },
    after: 'the-one-atlas-minted',
  });
  assert.equal(atlas.sent[0].after, 'the-one-atlas-minted');
  assert.equal(answered.after, 'a-second-one');
});

test('a first page carries no continuation', async () => {
  const atlas = fakeAtlas({ body: [], after: null });
  await listIssues({ atlas: atlas.handle, filters: { state: 'open', labels: '' } });
  assert.equal(atlas.sent[0].after, null);
});

test("one of the door's named answers is left to Atlas, and nothing is said about it", async () => {
  const atlas = fakeAtlas({ answer: 'rateLimited', because: "Atlas's own sentence." });
  const answered = await listIssues({
    atlas: atlas.handle,
    filters: { state: 'open', labels: '' },
    after: null,
  });
  assert.deepEqual(answered, { rows: [], after: null });
});

test('a row holds exactly the four columns the screen declared', async () => {
  const atlas = fakeAtlas({ body: [anIssue()], after: null });
  const answered = await listIssues({
    atlas: atlas.handle,
    filters: { state: 'open', labels: '' },
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
    filters: { state: 'open', labels: '' },
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
    listIssues({ atlas: atlas.handle, filters: { state: 'open', labels: '' }, after: null }),
  );
});

test('it calls once and does not try again', async () => {
  const atlas = fakeAtlas({ body: [anIssue({ state: 'merged' })], after: null });
  await assert.rejects(
    listIssues({ atlas: atlas.handle, filters: { state: 'open', labels: '' }, after: null }),
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
    filters: { state: 'open', labels: 'bug' },
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
    filters: { state: 'open', labels: 'bug, x&state=all' },
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

/**
 * `rowsIn` and `rowIn` from Atlas's screen seam, written against declarations.
 *
 * **It names no field**, which is the whole of what `Hosts C3b` moved. It takes
 * the columns out of this plugin's own manifest and holds a row to them: every
 * one present, every one the kind it was declared as, and nothing beside them.
 * A choice is checked against the values the column declared — so a state this
 * plugin invented and the manifest never named would be refused here, exactly as
 * Atlas refuses it.
 */
function atlasReadsRows(result, columns) {
  const isFields = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
  const named = columns.map((one) => one.column);
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
    // A row carrying a field its screen did not declare refuses the whole answer
    // rather than being trimmed: a list with the bad rows quietly dropped looks
    // complete and is not.
    for (const field of Object.keys(one)) {
      if (!named.includes(field)) {
        return null;
      }
    }
    const row = {};
    for (const column of columns) {
      const value = one[column.column];
      if (column.kind === 'text' && typeof value !== 'string') {
        return null;
      }
      if (column.kind === 'number' && (typeof value !== 'number' || !Number.isInteger(value))) {
        return null;
      }
      if (
        column.kind === 'choice' &&
        !(typeof value === 'string' && column.values.some((held) => held.value === value))
      ) {
        return null;
      }
      if (
        column.kind === 'texts' &&
        !(Array.isArray(value) && value.every((held) => typeof held === 'string'))
      ) {
        return null;
      }
      row[column.column] = value;
    }
    rows.push(row);
  }
  return rows;
}

test('what it answers is what Atlas will draw, checked the way Atlas checks it', async () => {
  const [screen] = (await readManifest()).contributes.screens;
  const { columns } = rowListOf(screen);
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
    filters: { state: 'all', labels: '' },
    after: null,
  });
  const read = atlasReadsRows(answered, columns);
  assert.notEqual(read, null, 'Atlas would refuse this answer');
  assert.deepEqual(read, [
    { number: 7, title: 'One', labels: ['bug'], state: 'open' },
    { number: 8, title: 'Two', labels: ['agent', 'bug'], state: 'closed' },
  ]);
});

test('a state the manifest never declared is refused by Atlas as well as by the plugin', async () => {
  const [screen] = (await readManifest()).contributes.screens;
  const { columns } = rowListOf(screen);
  // The plugin throws on it first, which is what actually happens. This is the
  // second check, and it is the one that says the manifest is what a row is held
  // to: a row wearing a state nothing declared is not one Atlas will draw.
  assert.equal(
    atlasReadsRows({ rows: [{ number: 1, title: 'One', labels: [], state: 'merged' }] }, columns),
    null,
  );
  assert.notEqual(
    atlasReadsRows({ rows: [{ number: 1, title: 'One', labels: [], state: 'open' }] }, columns),
    null,
  );
});

test('a row carrying a field the screen never declared refuses the whole answer', async () => {
  const [screen] = (await readManifest()).contributes.screens;
  const { columns } = rowListOf(screen);
  assert.equal(
    atlasReadsRows(
      { rows: [{ number: 1, title: 'One', labels: [], state: 'open', body: 'not a column' }] },
      columns,
    ),
    null,
  );
});

test('a value of the wrong kind refuses the row, one case for each of the four', async () => {
  const [screen] = (await readManifest()).contributes.screens;
  const { columns } = rowListOf(screen);
  const sound = { number: 1, title: 'One', labels: [], state: 'open' };
  assert.notEqual(atlasReadsRows({ rows: [sound] }, columns), null);
  for (const wrong of [
    { number: '1' },
    { number: 1.5 },
    { title: 7 },
    { labels: 'bug' },
    { labels: [7] },
    { state: 'merged' },
  ]) {
    assert.equal(atlasReadsRows({ rows: [{ ...sound, ...wrong }] }, columns), null);
  }
});

test('an empty answer is still one Atlas will draw', async () => {
  const [screen] = (await readManifest()).contributes.screens;
  const { columns } = rowListOf(screen);
  const atlas = fakeAtlas({ answer: 'notFound', because: "Atlas's own sentence." });
  const answered = await listIssues({
    atlas: atlas.handle,
    filters: { state: 'open', labels: '' },
    after: null,
  });
  assert.deepEqual(atlasReadsRows(answered, columns), []);
});
