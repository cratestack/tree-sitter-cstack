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

/// Tag queries (`@definition.*` / `@reference.*`), for code-navigation and
/// code-graph tools.
///
/// Note that `.cstack` is declarative and has **no call sites**, so this query
/// emits no `@reference.call`. A consumer building a call graph will find zero
/// call edges in a `.cstack` file; that is the language, not a gap in the query.
pub const TAGS_QUERY: &str = include_str!("../../queries/tags.scm");

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
    fn tags_query_compiles_and_classifies_each_declaration_kind() {
        let language: tree_sitter::Language = super::LANGUAGE.into();
        let query = tree_sitter::Query::new(&language, super::TAGS_QUERY)
            .expect("the bundled tags query should compile against this grammar");

        let source = concat!(
            "mixin Timestamps {\n  createdAt DateTime\n}\n\n",
            "enum Role {\n  Admin\n}\n\n",
            "type Money {\n  amount Int\n}\n\n",
            "model User {\n  id Int @id\n  role Role\n}\n\n",
            "procedure ping(): Int\n\n",
            "query totals(userId: String): Money\n  @@sql(\"SELECT 1\")\n",
        );

        let mut parser = tree_sitter::Parser::new();
        parser.set_language(&language).expect("grammar loads");
        let tree = parser.parse(source, None).expect("parses");

        let mut cursor = tree_sitter::QueryCursor::new();
        let mut kinds = std::collections::BTreeSet::new();
        let mut matches = cursor.matches(&query, tree.root_node(), source.as_bytes());
        while let Some(m) = tree_sitter::StreamingIterator::next(&mut matches) {
            for capture in m.captures {
                kinds.insert(query.capture_names()[capture.index as usize].to_owned());
            }
        }

        for expected in [
            "definition.class",
            "definition.interface",
            "definition.enum",
            "definition.function",
        ] {
            assert!(kinds.contains(expected), "missing {expected}: {kinds:?}");
        }
        assert!(
            !kinds.contains("reference.call"),
            "`.cstack` is declarative and has no call sites",
        );
    }

    /// A `query` block is a *definition*, and specifically not a call site:
    /// it is declared in the schema and its body is its own SQL. The tags
    /// query has to name it, or a code-graph consumer silently loses every
    /// `query` in a schema — which looks identical to a schema that has none.
    #[test]
    fn query_declaration_is_tagged_as_a_definition() {
        let language: tree_sitter::Language = super::LANGUAGE.into();
        let query = tree_sitter::Query::new(&language, super::TAGS_QUERY)
            .expect("the bundled tags query should compile against this grammar");

        let source = "query totals(userId: String): Money\n  @@sql(\"SELECT 1\")\n";

        let mut parser = tree_sitter::Parser::new();
        parser.set_language(&language).expect("grammar loads");
        let tree = parser.parse(source, None).expect("parses");
        assert!(
            !tree.root_node().has_error(),
            "a `query` block should parse without errors",
        );

        let mut cursor = tree_sitter::QueryCursor::new();
        let mut definitions = Vec::new();
        let mut matches = cursor.matches(&query, tree.root_node(), source.as_bytes());
        while let Some(m) = tree_sitter::StreamingIterator::next(&mut matches) {
            let capture_names: Vec<&str> = m
                .captures
                .iter()
                .map(|capture| query.capture_names()[capture.index as usize])
                .collect();
            if !capture_names.contains(&"definition.function") {
                continue;
            }
            for capture in m.captures {
                if query.capture_names()[capture.index as usize] == "name" {
                    definitions.push(
                        capture
                            .node
                            .utf8_text(source.as_bytes())
                            .expect("utf8")
                            .to_owned(),
                    );
                }
            }
        }

        assert_eq!(definitions, vec!["totals".to_owned()]);
    }

    #[test]
    fn highlights_query_compiles() {
        tree_sitter::Query::new(&super::LANGUAGE.into(), super::HIGHLIGHTS_QUERY)
            .expect("the bundled highlights query should compile against this grammar");
    }
}
