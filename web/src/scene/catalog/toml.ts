// Small TOML reader for config/catalog*.toml, so the bundle carries the catalog
// without a build step. Subset: comments, [[catalog]] tables, key = value with
// basic or literal strings, numbers, booleans, arrays (multi-line too) and
// inline tables. Anything else throws, and the caller skips that file.

export type TomlValue = string | number | boolean | TomlValue[] | { [k: string]: TomlValue };
export type TomlTable = Record<string, TomlValue>;

class Reader {
  i = 0;
  constructor(readonly s: string) {}

  fail(msg: string): never {
    const line = this.s.slice(0, this.i).split("\n").length;
    throw new Error(`toml line ${line}: ${msg}`);
  }

  // skips spaces, and newlines plus comments when inside brackets
  gap(multiline: boolean): void {
    for (;;) {
      const c = this.s[this.i];
      if (c === " " || c === "\t" || c === "\r") this.i++;
      else if (multiline && c === "\n") this.i++;
      else if (multiline && c === "#") while (this.i < this.s.length && this.s[this.i] !== "\n") this.i++;
      else return;
    }
  }

  key(): string {
    this.gap(false);
    const c = this.s[this.i];
    if (c === '"' || c === "'") return this.str();
    const m = /^[A-Za-z0-9_-]+/.exec(this.s.slice(this.i));
    if (!m) this.fail("expected a key");
    this.i += m[0].length;
    return m[0];
  }

  str(): string {
    const q = this.s[this.i];
    if (this.s.startsWith(q.repeat(3), this.i)) {
      const end = this.s.indexOf(q.repeat(3), this.i + 3);
      if (end < 0) this.fail("unterminated string");
      let body = this.s.slice(this.i + 3, end);
      this.i = end + 3;
      if (body.startsWith("\n")) body = body.slice(1);
      return q === '"' ? unescape(body.replace(/\\\r?\n\s*/g, "")) : body;
    }
    let j = this.i + 1;
    let out = "";
    for (; j < this.s.length; j++) {
      const ch = this.s[j];
      if (ch === "\n") this.fail("newline in string");
      if (ch === q) break;
      if (ch === "\\" && q === '"') {
        out += this.s.slice(j, j + 2);
        if (this.s[j + 1] === "u") {
          out += this.s.slice(j + 2, j + 6);
          j += 4;
        }
        j++;
        continue;
      }
      out += ch;
    }
    if (j >= this.s.length) this.fail("unterminated string");
    this.i = j + 1;
    return q === '"' ? unescape(out) : out;
  }

  value(): TomlValue {
    this.gap(false);
    const c = this.s[this.i];
    if (c === '"' || c === "'") return this.str();
    if (c === "[") {
      this.i++;
      const arr: TomlValue[] = [];
      for (;;) {
        this.gap(true);
        if (this.s[this.i] === "]") {
          this.i++;
          return arr;
        }
        arr.push(this.value());
        this.gap(true);
        if (this.s[this.i] === ",") this.i++;
        else if (this.s[this.i] !== "]") this.fail("expected , or ]");
      }
    }
    if (c === "{") {
      this.i++;
      const t: TomlTable = {};
      for (;;) {
        this.gap(true);
        if (this.s[this.i] === "}") {
          this.i++;
          return t;
        }
        const k = this.key();
        this.gap(false);
        if (this.s[this.i] !== "=") this.fail("expected =");
        this.i++;
        t[k] = this.value();
        this.gap(true);
        if (this.s[this.i] === ",") this.i++;
        else if (this.s[this.i] !== "}") this.fail("expected , or }");
      }
    }
    const m = /^[^\s,\]}#]+/.exec(this.s.slice(this.i));
    if (!m) this.fail("expected a value");
    this.i += m[0].length;
    if (m[0] === "true") return true;
    if (m[0] === "false") return false;
    const n = Number(m[0].replace(/_/g, ""));
    if (!Number.isFinite(n)) this.fail(`unsupported value ${m[0]}`);
    return n;
  }

  // rest of line must be blank or a comment
  eol(): void {
    this.gap(false);
    if (this.s[this.i] === "#") while (this.i < this.s.length && this.s[this.i] !== "\n") this.i++;
    if (this.i < this.s.length && this.s[this.i] !== "\n") this.fail("trailing text");
    this.i++;
  }
}

function unescape(s: string): string {
  return s.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_m, e: string) => {
    if (e.length === 5) return String.fromCharCode(parseInt(e.slice(1), 16));
    return ({ n: "\n", t: "\t", r: "\r", '"': '"', "\\": "\\" } as Record<string, string>)[e] ?? e;
  });
}

// Returns the rows of every [[name]] array of tables; top-level keys are ignored.
export function parseTomlTables(src: string, name: string): TomlTable[] {
  const r = new Reader(src);
  const rows: TomlTable[] = [];
  let cur: TomlTable | null = null;
  while (r.i < src.length) {
    r.gap(false);
    const c = src[r.i];
    if (c === "\n" || c === "#" || c === undefined) {
      r.eol();
      continue;
    }
    if (c === "[") {
      const end = src.indexOf("\n", r.i);
      const head = src.slice(r.i, end < 0 ? src.length : end).replace(/#.*$/, "").trim();
      r.i = end < 0 ? src.length : end + 1;
      if (head === `[[${name}]]`) {
        cur = {};
        rows.push(cur);
      } else cur = null;
      continue;
    }
    const k = r.key();
    r.gap(false);
    if (src[r.i] !== "=") r.fail("expected =");
    r.i++;
    const v = r.value();
    if (cur) cur[k] = v;
    r.eol();
  }
  return rows;
}
