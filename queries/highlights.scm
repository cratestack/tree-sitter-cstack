; Highlight queries for `.cstack`.
;
; Capture names follow the tree-sitter convention shared by nvim-treesitter,
; Helix and Zed, so a stock theme styles this without extra configuration.

; ---- keywords -------------------------------------------------------------
[
  "datasource"
  "auth"
  "mcp"
  "extension"
  "transport"
  "mixin"
  "model"
  "type"
  "enum"
  "view"
  "from"
  "procedure"
  "mutation"
] @keyword

; ---- declaration names ----------------------------------------------------
(model_declaration name: (identifier) @type)
(type_declaration name: (identifier) @type)
(mixin_declaration name: (identifier) @type)
(view_declaration name: (identifier) @type)
(enum_declaration name: (identifier) @type)
(auth_block name: (identifier) @type)

(datasource_block name: (identifier) @namespace)
(extension_block name: (identifier) @namespace)

(procedure_declaration name: (identifier) @function)

; ---- references -----------------------------------------------------------
; Every type reference, including generic arguments and view sources.
(type_identifier) @type
(view_declaration source: (identifier) @type)
(use_directive mixin: (identifier) @type)

(enum_variant name: (identifier) @constant)

; ---- members --------------------------------------------------------------
(field name: (identifier) @property)
(parameter name: (identifier) @variable.parameter)
(config_entry key: (identifier) @property)
(function_call name: (identifier) @function.call)

; ---- attributes -----------------------------------------------------------
(attribute_name) @attribute
(block_attribute_name) @attribute
"@use" @attribute

; ---- literals -------------------------------------------------------------
(string) @string
(number) @number
(boolean) @boolean

; ---- punctuation ----------------------------------------------------------
[
  "{"
  "}"
  "("
  ")"
  "["
  "]"
  "<"
  ">"
] @punctuation.bracket

[
  ","
  ":"
  "."
] @punctuation.delimiter

[
  "[]"
  "?"
] @punctuation.special

"=" @operator

; ---- comments -------------------------------------------------------------
; `///` carries API documentation and is worth distinguishing from `//`.
(doc_comment) @comment.documentation
(line_comment) @comment
