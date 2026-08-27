# tree-sitter-cstack

Tree-sitter grammar for [CrateStack](https://github.com/cratestack/cratestack)
`.cstack` schema files.

## What this is for

Editor support in **Neovim, Helix and Zed**, which consume tree-sitter grammars
by repository URL.

It is deliberately *not* used by CrateStack's VS Code extension. VS Code has no
tree-sitter API for third-party languages
([microsoft/vscode#50140](https://github.com/microsoft/vscode/issues/50140) has
been open since 2018), and the workaround — compiling a grammar to wasm and
driving the Semantic Token API from the extension — buys nothing there, because
`cratestack-lsp` already has a real parse in-process and emits semantic tokens
directly. VS Code gets its identifier colouring from the language server; this
grammar serves the editors the language server cannot reach that way.

## This is not the authoritative parser

`cratestack-parser` (chumsky, in the CrateStack monorepo) decides what a
`.cstack` file *means*. This grammar only describes its *shape*, and is
deliberately more permissive:

- Unknown attributes, unknown mixins, invalid `provider` values and duplicate
  names all parse fine here. They are semantic errors, and reporting them is the
  language server's job.
- Attribute arguments are parsed as a balanced but otherwise opaque token run.
  `@relation(fields: [a], references: [b])`, `@allow(auth() != null)` and
  `@default(now())` have little in common, and pinning each one down would turn
  this grammar into a second semantic checker.

That permissiveness is the point: an editor that stops highlighting because a
relation target does not exist yet is an editor that stops highlighting
constantly.

## Keeping the two in sync

Two independent descriptions of one syntax will drift unless something forces
them together. [`test/conformance.sh`](test/conformance.sh) is that something:
it parses **every `.cstack` file the CrateStack repo ships** and fails on any
unexpected `ERROR` node.

```bash
./test/conformance.sh /path/to/cratestack
```

```text
schemas parsed:       186
expected failures:    1
unexpected errors:    0
wrongly accepted:     0
OK
```

The one expected failure is a fixture with a deliberately unbalanced paren.
CrateStack's `semantic_error_*` fixtures are *not* expected failures — they are
syntactically well-formed and must parse cleanly, which is the permissiveness
above stated as a test.

CI runs this against `cratestack@main` on every push and weekly on a schedule,
so an upstream syntax change surfaces here even when nothing lands in this repo.

## Usage

### Neovim (nvim-treesitter)

```lua
require("nvim-treesitter.parsers").get_parser_configs().cstack = {
  install_info = {
    url = "https://github.com/cratestack/tree-sitter-cstack",
    files = { "src/parser.c" },
    branch = "main",
  },
  filetype = "cstack",
}

vim.filetype.add({ extension = { cstack = "cstack" } })
```

Then `:TSInstall cstack`, and copy `queries/highlights.scm` into your
`queries/cstack/` directory.

### Rust

```toml
[dependencies]
tree-sitter = "0.25"
tree-sitter-cstack = "0.1"
```

```rust
let mut parser = tree_sitter::Parser::new();
parser.set_language(&tree_sitter_cstack::LANGUAGE.into())?;
let tree = parser.parse(source, None).unwrap();
```

`tree_sitter_cstack::HIGHLIGHTS_QUERY` bundles the highlight queries.

## Development

```bash
npm install
npx tree-sitter generate   # regenerate src/ after editing grammar.js
npx tree-sitter test       # corpus tests in test/corpus/
cargo test                 # Rust bindings
```

`src/` is committed so consumers do not need the CLI. CI fails if it is stale
relative to `grammar.js`.

## License

MIT. See [LICENSE](LICENSE).
