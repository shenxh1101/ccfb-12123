import type { ConfigNode, Evidence, RuleStatus } from '../types';

/** A desired end state for one directive, resolved to a concrete location. */
export interface FixTarget {
  key: string;
  /** Desired argument list; empty + remove=true means delete the directive. */
  args: string[];
  /** Existing directive to edit (replace or delete). */
  node?: ConfigNode;
  /** Block to insert into when no local directive exists. */
  anchor?: ConfigNode;
  /** Remove the directive instead of setting it. */
  remove?: boolean;
  /** File used when the directive is absent and no anchor exists. */
  fallbackFile: string;
  /** Optional trailing text such as `;` for nginx. Omit to derive from model kind. */
  note?: string;
}

export interface EvalOutcome {
  status: RuleStatus;
  message: string;
  evidence: Evidence[];
  observed?: string;
  expected?: string;
  /** Directives that should exist after remediation. */
  targets?: FixTarget[];
}

export function evidenceOf(node: ConfigNode, note?: string): Evidence {
  return {
    file: node.file,
    line: node.line,
    column: node.column,
    snippet: node.raw,
    via: node.via,
    block: node.block,
    note,
  };
}

export function compareNumeric(actual: number, op: string, expected: number): boolean {
  switch (op) {
    case '>=':
      return actual >= expected;
    case '<=':
      return actual <= expected;
    case '>':
      return actual > expected;
    case '<':
      return actual < expected;
    case '==':
      return actual === expected;
    case '!=':
      return actual !== expected;
    default:
      return false;
  }
}

export function eq(a: string | undefined, b: string, caseInsensitive?: boolean): boolean {
  if (a === undefined) return false;
  return caseInsensitive ? a.toLowerCase() === b.toLowerCase() : a === b;
}
