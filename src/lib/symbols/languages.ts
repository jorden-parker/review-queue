import path from "node:path";

export type LanguageSpec = { grammar: string; definitionQuery: string };

const TYPESCRIPT_QUERY = `
(function_declaration name: (identifier) @function)
(generator_function_declaration name: (identifier) @function)
(class_declaration name: (type_identifier) @class)
(abstract_class_declaration name: (type_identifier) @class)
(method_definition name: (property_identifier) @method)
(interface_declaration name: (type_identifier) @interface)
(type_alias_declaration name: (type_identifier) @type)
(enum_declaration name: (identifier) @enum)
(variable_declarator name: (identifier) @function value: [(arrow_function) (function_expression)])
(program (lexical_declaration (variable_declarator name: (identifier) @constant)))
(export_statement (lexical_declaration (variable_declarator name: (identifier) @constant)))
`;

const JAVASCRIPT_QUERY = `
(function_declaration name: (identifier) @function)
(generator_function_declaration name: (identifier) @function)
(class_declaration name: (identifier) @class)
(method_definition name: (property_identifier) @method)
(variable_declarator name: (identifier) @function value: [(arrow_function) (function_expression)])
(program (lexical_declaration (variable_declarator name: (identifier) @constant)))
(export_statement (lexical_declaration (variable_declarator name: (identifier) @constant)))
`;

const GO_QUERY = `
(function_declaration name: (identifier) @function)
(method_declaration name: (field_identifier) @method)
(type_spec name: (type_identifier) @type)
(source_file (const_declaration (const_spec name: (identifier) @constant)))
(source_file (var_declaration (var_spec name: (identifier) @variable)))
`;

const PYTHON_QUERY = `
(function_definition name: (identifier) @function)
(class_definition name: (identifier) @class)
(module (expression_statement (assignment left: (identifier) @variable)))
`;

const RUST_QUERY = `
(function_item name: (identifier) @function)
(struct_item name: (type_identifier) @class)
(enum_item name: (type_identifier) @enum)
(trait_item name: (type_identifier) @interface)
(type_item name: (type_identifier) @type)
(const_item name: (identifier) @constant)
(static_item name: (identifier) @constant)
`;

const SPECS: Record<string, LanguageSpec> = {
  ".ts": { grammar: "typescript", definitionQuery: TYPESCRIPT_QUERY },
  ".mts": { grammar: "typescript", definitionQuery: TYPESCRIPT_QUERY },
  ".cts": { grammar: "typescript", definitionQuery: TYPESCRIPT_QUERY },
  ".tsx": { grammar: "tsx", definitionQuery: TYPESCRIPT_QUERY },
  ".js": { grammar: "javascript", definitionQuery: JAVASCRIPT_QUERY },
  ".jsx": { grammar: "javascript", definitionQuery: JAVASCRIPT_QUERY },
  ".mjs": { grammar: "javascript", definitionQuery: JAVASCRIPT_QUERY },
  ".cjs": { grammar: "javascript", definitionQuery: JAVASCRIPT_QUERY },
  ".go": { grammar: "go", definitionQuery: GO_QUERY },
  ".py": { grammar: "python", definitionQuery: PYTHON_QUERY },
  ".rs": { grammar: "rust", definitionQuery: RUST_QUERY },
};

export function languageFor(file: string): LanguageSpec | null {
  return SPECS[path.extname(file)] ?? null;
}

export function supportedSpecs(): LanguageSpec[] {
  return [...new Map(Object.values(SPECS).map((spec) => [spec.grammar, spec])).values()];
}
