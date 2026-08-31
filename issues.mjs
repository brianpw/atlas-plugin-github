// What this plugin knows, which is GitHub's dialect and nothing else.
//
// Atlas is in charge of git and of the key. It is not in charge of issues: it
// fills `{owner}` and `{repository}` from the repository's own record, attaches
// the connection's token, sends the call this plugin declared, and hands back
// what came out — parsed, redacted, and unread. **What that answer means is this
// file's job**, and there is nowhere else on this machine that knows it.
//
// **Nothing here reaches anything.** There is no address in this file, no header,
// no method and no path — those are in `manifest.json`, fixed before anybody
// agreed to install this, and Atlas is what sends them. What crosses the channel
// from here is the name of one declared call, values for the three parameters
// that call said it would fill, and a continuation Atlas minted and this plugin
// cannot read.
//
// **Nothing is held between calls.** Every value in this file is made inside the
// function that uses it and is gone when it returns, so a call that ran out of
// time can leave the process stopped with nothing lost. There is no cache, no
// page count, and no last-seen anything — module scope holds functions and no
// state at all.
//
// **Everything here is exported**, including the two shaping functions Atlas
// never calls. That is what keeps the rule above checkable by reading rather than
// by trusting: a value at module scope would be a value that is not an export,
// and there are none.

/**
 * One page of a repository's issues, shaped into the rows this plugin's screen
 * declared.
 *
 * Atlas calls this inside the cage, with the repository's name, the filters the
 * person committed, and where to carry on from. **One call in, one call out.**
 * Nothing here loops, reads ahead, retries or waits: a failed call is one of the
 * door's named answers, and a plugin deciding to try again would be a plugin
 * spending somebody's rate limit on a decision nobody agreed to.
 */
export async function listIssues({ atlas, filters, after }) {
  // **Ten, and the reason travels with the number.** The number that matters is
  // not how many issues read well on a screen — it is how many fit through the
  // channel Atlas carries the answer across. That channel takes about 258,000
  // characters. Fifty issues from a real repository measured 380,920, so fifty
  // never arrived at all: Atlas fetched them, could not hand them over, and this
  // plugin waited for an answer that was never coming until the deadline killed
  // it.
  //
  // **The arithmetic, so the next person does not have to redo it.** That
  // measurement is about 7,600 characters an issue, which puts the ceiling near
  // thirty-three with no margin at all — and an issue's size varies by an order
  // of magnitude, because a body is whatever somebody typed. Ten is about 76,000
  // characters, three times under the limit, and still more rows than fit on a
  // screen. **Anything above about twenty is a number that works until somebody
  // writes a long issue.**
  //
  // **A page may hold fewer than ten and still not be the end of the list**,
  // because the pull requests below are dropped after GitHub has counted them.
  // A short page is not the last page, and what says whether there is more is
  // the continuation Atlas hands back, never the number of rows.
  const perPage = 10;

  // **Every filter arrives as text**, one value per filter this plugin's screen
  // declared, under the name it declared. That is Atlas handing over what a
  // person chose or typed and nothing more: it checked that a chosen value is
  // one the choice offers, and it knows nothing at all about what any of them
  // means. **What a comma in a typed one means is this file's decision**, and
  // `labelsAsked` below is where it is made.
  const asked = filters ?? {};
  const values = {
    // **The default is sent rather than left off.** A parameter omitted is a
    // parameter whose meaning belongs to GitHub, and open is what this screen
    // says it shows when nobody has said otherwise.
    state: typeof asked.state === 'string' && asked.state !== '' ? asked.state : 'open',
    per_page: perPage,
  };
  const labels = labelsAsked(asked.labels);
  if (labels.length > 0) {
    // Joined into one value, never into a name. Atlas builds the query through
    // `URLSearchParams`, so a label called `x&state=all` is one label with an odd
    // name rather than a second filter nobody offered.
    values.labels = labels.join(',');
  }

  // The call's own identifier and values for the three parameters it declared.
  // The continuation is a field of its own because it is not one of them: it is
  // a handle Atlas minted, good for one plugin, one repository and one call, and
  // this plugin can neither read it nor compare it.
  const answered = await atlas.send('readIssues', values, after ?? null);

  if (answered === null || typeof answered !== 'object') {
    throw new Error('Atlas answered with something this plugin could not read.');
  }
  if ('answer' in answered) {
    // One of the door's eight named answers. **There is nothing to add here and
    // nothing to say**: Atlas wrote the answer down on its own side while the
    // call was running, and the words a person reads are Atlas's. A plugin able
    // to say *no token is stored* is a plugin able to ask for one.
    return { rows: [], after: null };
  }

  return { rows: rowsFrom(answered.body), after: answered.after ?? null };
}

/**
 * The label names in what somebody typed into the Labels field.
 *
 * **The field is one line of text and the plugin decides what it means.** Atlas
 * declines to have an opinion — it hands over the characters as typed and says
 * nothing under the field about what a comma would do — so the reading is here,
 * with its reason, rather than anywhere it could be assumed.
 *
 * **The separator is a comma because GitHub's own `labels` parameter is a
 * comma-separated list.** This is not a syntax this plugin invented; it is the
 * one already on the other end, passed through. Anything else would be a second
 * spelling for the same thing, and the person typing it would have to know which
 * of the two they were writing in.
 *
 * **A label whose name contains a comma cannot be asked for here, and that is
 * GitHub's limit rather than this plugin's choice.** GitHub allows a comma in a
 * label name and offers no escape for one in the parameter, so every possible
 * spelling of such a name arrives there as two names. An escape invented on this
 * side would be undone one line later, when the pieces are joined back into the
 * one value GitHub takes — so the split is the honest one, and the trade is
 * stated rather than hidden: that label is out of reach of this filter, while
 * still being drawn in the Labels column of every row that carries it.
 *
 * **Each name is trimmed, and empties are dropped**, so that `bug, agent` — which
 * is how a person writes a list — asks for two labels rather than for one called
 * ` agent`, and a trailing comma asks for nothing extra. A label whose name
 * begins or ends with a space is out of reach for the same reason and by the same
 * trade.
 *
 * **Anything that is not text is nothing.** Every filter arrives as text, so this
 * cannot happen through Atlas; answering with none rather than throwing keeps a
 * shape nobody sends from being the thing that fails a screen.
 */
export function labelsAsked(typed) {
  if (typeof typed !== 'string') {
    return [];
  }
  return typed
    .split(',')
    .map((one) => one.trim())
    .filter((one) => one !== '');
}

/**
 * Every issue in one of GitHub's answers, in the order GitHub gave them, with
 * the pull requests gone.
 *
 * **A pull request is not an issue, and only something that knows GitHub knows
 * that.** GitHub returns pull requests from the issues address — every pull
 * request is an issue in its data model, and its own issues page hides them
 * again on the way out. Atlas used to hold this rule, and handing over the
 * dialect while keeping this one line would have been Atlas keeping the dialect
 * and pretending otherwise. So it lives here, with its reason beside it: a line
 * without its paragraph is a line somebody deletes.
 *
 * **Dropped before the rows and before the count**, which is why a page can hold
 * thirty rows out of fifty items and still not be the end of the list.
 *
 * **An item this cannot read fails the whole answer.** A list with the bad rows
 * quietly dropped looks complete and is not, and the person reading it has no way
 * to tell. Atlas applies the same rule again on its own side, and the two agree
 * on purpose.
 */
export function rowsFrom(body) {
  if (!Array.isArray(body)) {
    throw new Error('GitHub answered with something that is not a list of issues.');
  }
  const rows = [];
  for (const item of body) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('GitHub answered with an item that is not an issue.');
    }
    if ('pull_request' in item) {
      continue;
    }
    rows.push(rowFrom(item));
  }
  return rows;
}

/**
 * One issue as a row, holding exactly the four columns this plugin's screen
 * declared and nothing beside them.
 *
 * **Read strictly.** A missing number, a missing title, a state this plugin has
 * no word for, or labels it cannot read all throw, and the throw takes the whole
 * answer with it. What reaches a person is Atlas's own sentence for a screen
 * whose plugin did not answer — nothing written here is ever drawn.
 *
 * **The two states are the two values the state column declares**, and they are
 * checked here as well as by Atlas on the way back. That is not a duplicate: the
 * manifest says what a person may see, this says what this plugin will vouch
 * for, and a `merged` arriving from somewhere is a thing whose meaning this file
 * is the only one that could have.
 *
 * **The labels are sorted.** GitHub's order is its own and is documented as
 * nothing, so two issues carrying the same two labels would otherwise read
 * differently on one row and on the next, which reads as a bug rather than as an
 * absence.
 */
export function rowFrom(issue) {
  const number = issue.number;
  if (typeof number !== 'number' || !Number.isInteger(number)) {
    throw new Error('An issue arrived with no number.');
  }
  const title = issue.title;
  if (typeof title !== 'string') {
    throw new Error('An issue arrived with no title.');
  }
  const state = issue.state;
  if (state !== 'open' && state !== 'closed') {
    throw new Error('An issue arrived in a state this plugin has no word for.');
  }
  // Written in the order the screen declares them, which is the order they are
  // drawn in. Atlas reads a row by name rather than by position, so this is for
  // whoever is reading the two files side by side.
  return { number, title, labels: labelsFrom(issue.labels), state };
}

/**
 * The names of an issue's labels, sorted.
 *
 * GitHub writes a label as an object carrying a name, and as a bare name where a
 * caller asked for less. Both are read; anything else fails the answer, for the
 * reason `rowsFrom` gives. Sorted by comparing the names themselves rather than
 * by collation, so the order is the same on every machine.
 */
export function labelsFrom(labels) {
  if (labels === undefined || labels === null) {
    return [];
  }
  if (!Array.isArray(labels)) {
    throw new Error('An issue arrived with labels this plugin could not read.');
  }
  const names = labels.map((label) => {
    if (typeof label === 'string') {
      return label;
    }
    if (label !== null && typeof label === 'object' && typeof label.name === 'string') {
      return label.name;
    }
    throw new Error('An issue arrived with a label this plugin could not read.');
  });
  return names.sort((one, other) => (one < other ? -1 : one > other ? 1 : 0));
}
