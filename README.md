# atlas-plugin-github

A GitHub plugin for [Atlas](https://github.com/brianpw/project-atlas).

Atlas is in charge of git and of the key. It is not in charge of issues. This
plugin is what tells Atlas what can be done with a GitHub issue and what the
screens for them look like.

## What it declares

- **The calls it needs**, as a fixed list in its manifest — method, path and
  which parts of the body it fills. Atlas reads that list, works out for itself
  what each call does, says so in its own words before anybody agrees to it,
  fills the path from the repository's record, attaches the connection's token
  and sends it. The plugin never holds the token and never learns the address.
- **The screens it contributes** — what an issues list shows, what it filters
  by, and what it calls its states.

## What it does not do yet

Creating, editing, commenting and labelling are writing, and writing comes
later. Reading is what version one is.

## Status

Nothing is built here yet. The contract this is written against is `Hosts C3`
and `Hosts C3b` in Atlas, and neither has landed.
