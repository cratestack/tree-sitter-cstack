/**
 * Tree-sitter grammar for CrateStack `.cstack` schema files.
 *
 * `cratestack-parser` (chumsky, in the cratestack monorepo) is the
 * authoritative parser and the only one that decides whether a schema is
 * *valid*. This grammar exists for editors that speak tree-sitter — Neovim,
 * Helix, Zed — and is deliberately more permissive: it recognises shape, not
 * semantics. Anything structurally well-formed parses here even if the real
 * parser would reject it (unknown attribute, unknown mixin, bad provider
 * value). That permissiveness is what keeps highlighting stable while you type.
 *
 * The conformance test (see `test/conformance`) checks this grammar against
 * every `.cstack` file in the cratestack repo and fails on any ERROR node, so
 * the two cannot silently drift apart on syntax we actually ship.
 */

const IDENTIFIER = /[A-Za-z_][A-Za-z0-9_]*/;

module.exports = grammar({
  name: "cstack",

  extras: ($) => [/\s/, $.line_comment],

  word: ($) => $.identifier,

  rules: {
    source_file: ($) => repeat($._declaration),

    _declaration: ($) =>
      choice(
        $.doc_comment,
        $.datasource_block,
        $.auth_block,
        $.mcp_block,
        $.extension_block,
        $.transport_directive,
        $.mixin_declaration,
        $.model_declaration,
        $.type_declaration,
        $.enum_declaration,
        $.view_declaration,
        $.procedure_declaration,
      ),

    // ---- comments -------------------------------------------------------
    // `///` is documentation attached to the next declaration; `//` is an
    // ordinary comment. Doc comments are a named node so queries can style
    // them differently, which is why they are not lumped into `extras`.
    doc_comment: (_) => token(seq("///", /.*/)),
    line_comment: (_) => token(prec(-1, seq("//", /.*/))),

    // ---- configuration blocks -------------------------------------------
    datasource_block: ($) =>
      seq("datasource", field("name", $.identifier), $.config_body),

    auth_block: ($) => seq("auth", field("name", $.identifier), $.field_body),

    mcp_block: ($) => seq("mcp", $.config_body),

    extension_block: ($) =>
      seq("extension", field("name", $.identifier), $.config_body),

    transport_directive: ($) =>
      seq("transport", optional(field("style", $.identifier))),

    config_body: ($) => seq("{", repeat($.config_entry), "}"),

    config_entry: ($) =>
      seq(field("key", $.identifier), "=", field("value", $._value)),

    _value: ($) =>
      choice(
        $.string,
        $.number,
        $.boolean,
        $.function_call,
        $.identifier,
        $.array,
      ),

    // `url = env("DATABASE_URL")` — config values may call a resolver rather
    // than inline a literal.
    function_call: ($) =>
      seq(
        field("name", $.identifier),
        "(",
        optional(seq($._value, repeat(seq(",", $._value)))),
        ")",
      ),

    array: ($) => seq("[", optional(seq($._value, repeat(seq(",", $._value)))), "]"),

    // ---- declarations with a field body ---------------------------------
    mixin_declaration: ($) =>
      seq("mixin", field("name", $.identifier), $.field_body),

    model_declaration: ($) =>
      seq("model", field("name", $.identifier), $.model_body),

    type_declaration: ($) =>
      seq("type", field("name", $.identifier), $.field_body),

    // `view Active from Customer, Order { ... }` — a view names the source
    // models it projects from.
    view_declaration: ($) =>
      seq(
        "view",
        field("name", $.identifier),
        optional(
          seq(
            "from",
            field("source", $.identifier),
            repeat(seq(",", field("source", $.identifier))),
          ),
        ),
        $.model_body,
      ),

    field_body: ($) => seq("{", repeat(choice($.doc_comment, $.field)), "}"),

    // A model body additionally allows `@use(...)` and `@@`-prefixed block
    // attributes alongside its fields.
    model_body: ($) =>
      seq(
        "{",
        repeat(
          choice($.doc_comment, $.use_directive, $.block_attribute, $.field),
        ),
        "}",
      ),

    field: ($) =>
      seq(
        field("name", $.identifier),
        field("type", $.type),
        repeat($.attribute),
      ),

    use_directive: ($) =>
      seq(
        "@use",
        "(",
        field("mixin", $.identifier),
        repeat(seq(",", field("mixin", $.identifier))),
        ")",
      ),

    // ---- enums ----------------------------------------------------------
    enum_declaration: ($) =>
      seq(
        "enum",
        field("name", $.identifier),
        "{",
        repeat(choice($.doc_comment, $.enum_variant)),
        "}",
      ),

    enum_variant: ($) => field("name", $.identifier),

    // ---- procedures -----------------------------------------------------
    procedure_declaration: ($) =>
      seq(
        optional("mutation"),
        "procedure",
        field("name", $.identifier),
        $.parameter_list,
        optional(seq(":", field("return_type", $.type))),
        repeat($.attribute),
      ),

    parameter_list: ($) =>
      seq(
        "(",
        optional(seq($.parameter, repeat(seq(",", $.parameter)))),
        ")",
      ),

    parameter: ($) =>
      seq(field("name", $.identifier), ":", field("type", $.type)),

    // ---- types ----------------------------------------------------------
    // `Page<Post>`, `Decimal(10, 2)`, `Post[]`, `String?`. Arity suffixes are
    // part of the type, not separate tokens, so highlighting a type reference
    // covers exactly the name.
    type: ($) =>
      seq(
        field("name", alias($.identifier, $.type_identifier)),
        optional($.type_arguments),
        optional($.scalar_arguments),
        optional(field("arity", choice("[]", "?"))),
      ),

    type_arguments: ($) =>
      seq("<", $.type, repeat(seq(",", $.type)), ">"),

    // `Decimal(10, 2)`'s precision, but also `Geography(Polygon, 4326)`'s
    // geometry subtype — a scalar argument is a number *or* a bare
    // identifier, which is what the authoritative parser accepts.
    scalar_arguments: ($) =>
      seq(
        "(",
        $._scalar_argument,
        repeat(seq(",", $._scalar_argument)),
        ")",
      ),

    _scalar_argument: ($) => choice($.number, $.identifier),

    // ---- attributes -----------------------------------------------------
    // Arguments are captured as a balanced, opaque token run. Attribute
    // argument grammars vary a lot (`@relation(fields: [a], references: [b])`,
    // `@allow(auth() != null)`, `@default(now())`) and pinning each one here
    // would make this grammar a semantic checker — which is the authoritative
    // parser's job, not an editor's.
    attribute: ($) =>
      seq(field("name", $.attribute_name), optional($.attribute_arguments)),

    block_attribute: ($) =>
      seq(field("name", $.block_attribute_name), optional($.attribute_arguments)),

    attribute_name: (_) => token(seq("@", IDENTIFIER)),
    block_attribute_name: (_) => token(seq("@@", IDENTIFIER)),

    attribute_arguments: ($) => seq("(", repeat($._argument_token), ")"),

    _argument_token: ($) =>
      choice(
        $.string,
        $.number,
        $.boolean,
        $.identifier,
        $.attribute_arguments,
        $.array,
        ":",
        ",",
        ".",
        // `@computed(params: ProxyParams?)` puts an arity marker inside the
        // argument run.
        "?",
        "[]",
        $._operator,
      ),

    _operator: (_) => token(choice("=", "==", "!=", "<", "<=", ">", ">=", "&&", "||", "!", "+", "-", "*", "/")),

    // ---- leaves ---------------------------------------------------------
    // `type_identifier` is this same token aliased inside a `type`, so queries
    // can colour a type reference without resolving it. It is an alias rather
    // than its own rule because a duplicated word-token rule is rejected
    // outright by the generator.
    identifier: (_) => IDENTIFIER,
    // Both quote styles are accepted: policy attributes in the wild use
    // single quotes (`@@allow('read', ...)`) as often as double.
    string: (_) =>
      token(
        choice(
          seq('"', repeat(choice(/[^"\\]/, seq("\\", /./))), '"'),
          seq("'", repeat(choice(/[^'\\]/, seq("\\", /./))), "'"),
        ),
      ),
    number: (_) => token(seq(optional("-"), /\d+/, optional(seq(".", /\d+/)))),
    boolean: (_) => choice("true", "false"),
  },
});
