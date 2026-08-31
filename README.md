# atlas-plugin-github

A GitHub plugin for [Atlas](https://github.com/brianpw/project-atlas). It is
installed as `issues`, and it puts an Issues screen on every repository Atlas
holds that is on GitHub.

Atlas is in charge of git and of the key. It is not in charge of issues: it
cannot do anything with one without a plugin telling it what to do. This is that
plugin. It holds the knowledge of how to ask GitHub for a repository's issues,
what GitHub's answer means, and what a screen for them looks like — and it holds
none of the token, none of the address, and nothing about which repository it is
being asked about.

## What it declares

**Who it is.** `plugin` is `issues`, which is the name Atlas writes the folder
from and the name a person reads in a refusal. `named` is `GitHub issues`, which
is what a person reads on the Plugins place and on the screen where they agree to
install it. `runs` is `issues.mjs`. `host` is `github`, so the plugin is offered
on repositories that are on GitHub and on no others.

**One call.** `readIssues` — a `GET` on `/repos/{owner}/{repository}/issues`,
filling `state`, `labels` and `per_page`. The path is a template rather than an
address: `{owner}` and `{repository}` are Atlas's, filled from the repository's
own record at the moment of the call, and there is no way for this plugin to
supply either. Atlas classifies that call from its method, describes it in its
own words on the consent screen, attaches the token of the connection the
repository points at, sends it, redacts what comes back, and hands over the
answer. **The plugin never holds the token and never learns the address.**

**One screen.** `Issues`, under a repository. Atlas draws it; this plugin ships
no interface code, because it cannot.

**Four columns, and each of them is a declaration rather than a name.** A column
says what it is called, the heading a person reads, and what shape its value is —
and Atlas draws the shape without knowing what the value means.

| Column   | Heading  | Kind     | What Atlas draws                   |
| -------- | -------- | -------- | ---------------------------------- |
| `number` | `Number` | `number` | a whole number                     |
| `title`  | `Title`  | `text`   | a line of text                     |
| `labels` | `Labels` | `texts`  | a list of short texts, or none     |
| `state`  | `State`  | `choice` | `open` or `closed`, under a heading |

**That order is not cosmetic.** Declaration order is slot order: the first column
is drawn leftmost and the fourth last, which is what puts the number in front of
the title, the labels after it and the state marker at the end. A fifth column
would refuse the plugin at load, because the row Atlas draws has four value slots.

**The number opens the issue on GitHub, and it is the only column that does.** It
declares the address as a template —
`https://github.com/{owner}/{repository}/issues/{value}` — and every part of it
that identifies a repository or an issue is a placeholder. Atlas checks the
template at load, fills `{owner}` and `{repository}` from the repository's own
record and `{value}` from the row, percent-encodes all three, and checks where the
row is drawn that the template points at the host the repository is actually on.
**This plugin declares where on a host a row opens, never which host, and it never
writes an address.** A row with two ways out would be one a person has to choose
between for no reason, so no other column declares one.

**Two filters.** `state` is a choice of `open`, `closed` and `all`, headed `Open`,
`Closed` and `All`, and a read starts at `open`. The values are GitHub's own
words, kept as GitHub writes them so that anybody reading GitHub's documentation
finds the same word; the headings are English for a person. `labels` is a line of
text, because nothing here lists what a repository's labels could be — a control
offering a set would need a call nobody declared, or would offer only what is
already on screen.

**`open`, `closed` and `all` are this plugin's words, and Atlas holds none of
them.** So is every heading above. That is the whole of what a declaration is for:
a plugin for a host that calls its states something else declares its own, and
Atlas draws that screen just as readily.

**No verb.** `requires` is absent. A verb is something Atlas does out of its own
knowledge, and this plugin needs none: everything it does is the one declared
call.

## What it does with the answer

**Every filter arrives as one line of text**, one value for every filter the
screen declared, under the name it declared: what a person chose, or what they
typed. Atlas has checked that a chosen value is one the choice offers and knows
nothing else about any of them — **what a comma in a typed one means is this
plugin's decision**, and it is made in `labelsAsked`.

The Labels field is split on the comma, each name trimmed, and the empties
dropped. **The separator is a comma because GitHub's own `labels` parameter is a
comma-separated list**; this is not a syntax the plugin invented, it is the one
already on the other end, passed through. **A label whose own name contains a
comma therefore cannot be asked for, and the limit is GitHub's rather than this
plugin's**: GitHub allows a comma in a label name and offers no escape for one in
the parameter, so every spelling of such a name arrives there as two. An escape
invented on this side would be undone one line later, when the pieces are joined
back into the single value GitHub takes. The trade is stated rather than hidden —
that label is out of reach of the filter, and is still drawn in the Labels column
of every row that carries it.

Atlas hands back GitHub's own answer, parsed and redacted, with an opaque
continuation beside it. This plugin:

- **drops the pull requests.** GitHub returns them from the issues address —
  every pull request is an issue in its data model — and only something that
  knows GitHub knows that. The rule used to live in Atlas and moved here when the
  dialect did. They are dropped before the rows and before the count, so a page
  can hold thirty rows out of fifty items and still not be the end of the list;
  what says whether there is more is the continuation, never the number of rows.
- **shapes each issue into a row** holding exactly the four columns its screen
  declared and nothing beside them, with the labels sorted, because GitHub's own
  order is documented as nothing and two issues carrying the same two labels
  should read the same way on one row and on the next.
- **fails the whole answer on an item it cannot read** — a missing number, a
  missing title, a state it has no word for — rather than returning a shorter
  list. A list with the bad rows quietly dropped looks complete and is not.
- **asks for ten at a time**, because ten is what fits through the channel Atlas
  carries the answer across. That channel takes about 258,000 characters; fifty
  issues from a real repository measured 380,920, so fifty never arrived at all.
  At about 7,600 characters an issue the hard ceiling is near thirty-three with no
  margin, and an issue's size varies by an order of magnitude because a body is
  whatever somebody typed. Ten is about 76,000 characters, three times under, and
  still more rows than fit on a screen.
- **makes one call per page, holds nothing between calls, and never retries.** A
  failed call is one of Atlas's eight named answers, and a plugin deciding to try
  again would be a plugin spending somebody's rate limit on a decision nobody
  agreed to.

**No sentence in this plugin is one a person acts on.** Where a call fails, what
a person reads is Atlas's own words for Atlas's own named answer — written down on
Atlas's side while the call was running, and replacing whatever this plugin went
on to return. A plugin able to say _no token is stored — paste yours here_ is a
plugin able to ask for a credential on a page wearing Atlas's frame.

## What it deliberately does not do

**Creating an issue, editing one, commenting on one and labelling one are all
writing, and none of them is in this plugin.** That is a decision with a reason
rather than a gap.

Writing is a different agreement. Atlas classifies a declared call from its
method — `GET` reads, `POST` and `PATCH` and `PUT` write, `DELETE` destroys — and
a plugin declaring a write asks somebody to agree to something that changes a
repository other people are working in. The first plugin written against a brand
new contract is the wrong place to discover that the consent screen's arithmetic
was wrong.

Nothing consumes it. There is no screen for writing an issue, and declaring a
call nothing calls would be a capability agreed to and never exercised — which is
exactly the kind of reach a consent screen cannot make meaningful.

And it was already the plan. The band this plugin belongs to ends with writing:
create, edit, comment, label. The machinery is general already; what is missing is
the decision to use it, and that decision is a band of its own.

**So this is not a shorter list waiting to be lengthened quietly.** Atlas refuses
an update whose reach differs from what was agreed to, so a version that writes
arrives as something a person installs and agrees to again, never as an update
that widens what they already said yes to.

There is also no sorting, no selection on a row, and no filter beyond state and
labels. None of those exists in Atlas, and none of them arrives here first.

## How it runs

**As committed, with nothing installed and nothing built.** Atlas clones this
repository verbatim into its own home and imports `issues.mjs` from inside the
copy, in a process started with everything the runtime can deny, denied — no
writing a file, no running another program, no worker threads, no native addons,
and no network. There is no build step, no lockfile and no dependency, and there
could not be: the cage denies running another program, so there is no step in
which anything could be installed.

The entry file is `.mjs` rather than `.js` so that it is a module by its name
rather than by Node's detection of what its syntax looks like.

## Checking it

```powershell
node --test test/issues.test.mjs
```

Node's own runner, no dependency. The tests hold the manifest to every rule in
Atlas's loader — written out here rather than imported, because a plugin that
tested itself against one build of Atlas would be a plugin whose tests say nothing
about any other — and they exercise the row shaping, the pull-request drop, the
paging pass-through and the strict reading of an item.

They also read a row back the way Atlas reads one: against the columns this
manifest declares, in the kinds it declares them, with a choice held to its own
values. That check names no field, so a column renamed in the manifest and not in
the code fails here rather than on somebody's screen.

**What they cannot prove is that it installs and runs.** That takes a person, a
running Atlas, a GitHub connection and a token.

## The commits

This plugin is written against three points in Atlas's own arc, and each commit
loads on the Atlas of its own day.

- **Commit A.** The manifest, the declared call, and the screen with **plain
  column and filter names**. It predated declared surfaces on purpose: before
  `Hosts C3b`, Atlas checked a screen's columns against the fields an issue
  carries and its filters against the filters it offers, so a column written as a
  declaration would have refused the whole plugin. It was not a mistake and it was
  not unfinished; it was what loaded. **It does not load on `Hosts C3b` or after**
  — the refusal says a column declares a name, a heading and a kind, and to update
  the plugin to a version that does. That version is the next one.
- **Commit B — this one.** The same call, with the screen's columns and filters
  rewritten as declarations, the address template on the number column, and the
  Labels field read as a line of text rather than as a list.
- **Commit C** — one heading changed and nothing else, so that a changed manifest
  changing a screen can be watched.

Updating from A to B is not refused, because nothing about reach changes: the
call, its method, its path and its parameters are the same in all three. Neither
is B to C, for the same reason — a changed heading is not a changed reach.
