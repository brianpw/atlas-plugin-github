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

**One screen.** `Issues`, under a repository, listing four columns — number,
title, state and labels — and filtering by state and by labels. Atlas draws it;
this plugin ships no interface code, because it cannot.

**No verb.** `requires` is absent. A verb is something Atlas does out of its own
knowledge, and this plugin needs none: everything it does is the one declared
call.

## What it does with the answer

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
- **asks for fifty at a time**, because a screenful of issues is tens rather than
  hundreds. A hundred is twice what anybody reads and makes Atlas's paging ceiling
  twice as coarse; GitHub's own thirty is a number GitHub chose for its own
  reasons and would change without telling anybody.
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
node --test
```

Node's own runner, no dependency. The tests hold the manifest to every rule in
Atlas's loader — written out here rather than imported, because a plugin that
tested itself against one build of Atlas would be a plugin whose tests say nothing
about any other — and they exercise the row shaping, the pull-request drop, the
paging pass-through and the strict reading of an item.

**What they cannot prove is that it installs and runs.** That takes a person, a
running Atlas, a GitHub connection and a token.

## The commits

This plugin is written against three points in Atlas's own arc, and each commit
loads on the Atlas of its own day.

- **Commit A — this one.** The manifest, the declared call, and the screen with
  **plain column and filter names**. It predates declared surfaces on purpose:
  until `Hosts C3b` lands, Atlas checks a screen's columns against the fields an
  issue carries and its filters against the filters it offers, so a column written
  as a declaration — with a heading, a kind, an address template — refuses the
  whole plugin. It is not a mistake and it is not unfinished; it is what loads.
- **Commit B** — the same call, with the screen's columns and filters rewritten as
  declarations, and the address template on the number column.
- **Commit C** — one heading changed and nothing else, so that a changed manifest
  changing a screen can be watched.

Updating from A to B is not refused, because nothing about reach changes: the
call, its method, its path and its parameters are the same in all three.
