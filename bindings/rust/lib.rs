//! Rust bindings for the CrateStack `.cstack` tree-sitter grammar.
//!
//! This grammar recognises shape, not semantics — `cratestack-parser` in the
//! cratestack monorepo remains the authority on whether a schema is valid. See
//! the crate README for why the two exist separately and how they are kept
//! from drifting.

use tree_sitter_language::LanguageFn;

unsafe extern "C" {
    fn tree_sitter_cstack() -> *const ();
}

/// The tree-sitter [`LanguageFn`] for `.cstack`.
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_cstack) };

/// Highlight queries, for editors that consume them from the crate rather than
/// from `queries/` on disk.
pub const HIGHLIGHTS_QUERY: &str = include_str!("../../queries/highlights.scm");

#[cfg(test)]
mod tests {
    #[test]
    fn can_load_grammar() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("loading the cstack grammar should succeed");

        let tree = parser
            .parse("model User {\n  id Int @id\n}\n", None)
            .expect("parsing should produce a tree");
        assert!(
            !tree.root_node().has_error(),
            "a well-formed schema should parse without errors",
        );
    }

    #[test]
    fn highlights_query_compiles() {
        tree_sitter::Query::new(&super::LANGUAGE.into(), super::HIGHLIGHTS_QUERY)
            .expect("the bundled highlights query should compile against this grammar");
    }
}
