; Tags for `.cstack`, in the tree-sitter tags convention (`@definition.*` /
; `@reference.*` paired with a `@name`). Consumed by code-navigation and
; code-graph tools that classify symbols from the grammar rather than from a
; language-specific extractor.
;
; The mapping to the convention's vocabulary, which is Java/JS-shaped and has no
; term for "schema declaration":
;
;   model / type / view -> class      a named record of fields
;   mixin               -> interface  a reusable field set mixed into models
;   enum                -> enum
;   procedure           -> function
;
; **`.cstack` has no call sites.** It is a declarative schema language:
; procedures are *declared* here and implemented in Rust, and nothing in a
; schema invokes anything else in it. So this file emits no `@reference.call`,
; and a consumer building a call graph will correctly find zero call edges for
; these files — that is the language being declarative, not the query being
; incomplete. Anything reporting a 0% resolution rate rather than "no call
; sites" is misreporting it.

(model_declaration
  name: (identifier) @name) @definition.class

(type_declaration
  name: (identifier) @name) @definition.class

(view_declaration
  name: (identifier) @name) @definition.class

(mixin_declaration
  name: (identifier) @name) @definition.interface

(enum_declaration
  name: (identifier) @name) @definition.enum

(procedure_declaration
  name: (identifier) @name) @definition.function

; Type references — every mention of a declared name as a field type, procedure
; parameter/return type, view source or `@use(...)` target. Not call references;
; consumers that only build call graphs ignore these by design.

(type
  name: (type_identifier) @name) @reference.type

(view_declaration
  source: (identifier) @name) @reference.type

(use_directive
  mixin: (identifier) @name) @reference.type
