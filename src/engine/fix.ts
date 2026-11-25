import type { ConfigFileModel, FixOp, FixPlan, RuleDefinition } from './types';
import type { EvalOutcome, FixTarget } from './evaluators/common';

function renderStatement(model: ConfigFileModel, key: string, args: string[]): string {
  if (model.kind === 'sysctl') return `${key} = ${args.join(' ')}`;
  const body = [key, ...args.map(quoteIfNeeded)].join(' ');
  return model.kind === 'sshd' ? body : `${body};`;
}

function quoteIfNeeded(value: string): string {
  if (/[\s;{}#]/.test(value) && !/^["'].*["']$/.test(value)) return `"${value.replace(/"/g, '\\"')}"`;
  return value;
}

/** Line number of the last global (non-Match) statement, so appended sshd
 *  directives never land inside a Match block. */
function sshdAppendLine(model: ConfigFileModel): { file: string; line: number } {
  const global = model.flat.filter((n) => n.block.length === 0 && n.key !== 'Match');
  const last = global[global.length - 1];
  if (!last) {
    // Empty file: insert at line 1 of the root.
    return { file: model.root, line: 0 };
  }
  return { file: last.file, line: last.line };
}

/** Insert position at the end of a block's body (before its closing brace). */
function blockInsertLine(model: ConfigFileModel, node: { line: number; endLine?: number }): { line: number; indent: string } {
  if (node.endLine && node.endLine > node.line) {
    const indentBase = indentOfNode(model, node.line);
    return { line: node.endLine, indent: `${indentBase}    ` };
  }
  return { line: node.line, indent: `${indentOfNode(model, node.line)}    ` };
}

function indentOfNode(model: ConfigFileModel, line: number): string {
  const node = model.flat.find((n) => n.line === line);
  if (!node) return '';
  const depth = node.block.length;
  return '    '.repeat(depth);
}

export function planFix(rule: RuleDefinition, model: ConfigFileModel, outcome: EvalOutcome): FixPlan {
  const targets = outcome.targets ?? [];
  const ops: FixOp[] = [];
  const creates = new Map<string, { lines: string[]; ruleIds: string[] }>();
  const seen = new Set<string>();

  const addOp = (op: FixOp) => {
    const key = `${op.kind}:${op.file}:${op.line}:${op.text ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    ops.push({ ...op, ruleId: rule.id });
  };

  for (const t of targets) {
    if (t.remove && t.node) {
      addOp({
        kind: 'delete',
        file: t.node.file,
        line: t.node.line,
        indent: '',
        reason: `删除不安全指令：${t.node.raw}`,
      });
      continue;
    }
    if (t.node) {
      const desired = renderStatement(model, t.key, t.args);
      if (t.node.raw.trim() === desired.trim()) continue;
      addOp({
        kind: 'replace',
        file: t.node.file,
        line: t.node.line,
        text: desired,
        reason: `${t.node.raw.trim()} → ${desired}`,
      });
      continue;
    }
    const desired = renderStatement(model, t.key, t.args);
    if (t.anchor) {
      const pos = blockInsertLine(model, t.anchor);
      addOp({
        kind: 'insertBefore',
        file: t.anchor.file,
        line: pos.line,
        text: desired,
        indent: pos.indent,
        reason: `在 ${t.anchor.key} 块末尾追加 ${t.key}`,
      });
      continue;
    }
    // No live directive and no block to hang it on.
    if (!model.availableFiles.includes(t.fallbackFile)) {
      const entry = creates.get(t.fallbackFile) ?? { lines: [], ruleIds: [] };
      if (!entry.lines.includes(desired)) entry.lines.push(desired);
      entry.ruleIds.push(rule.id);
      creates.set(t.fallbackFile, entry);
      continue;
    }
    if (model.kind === 'sshd') {
      const pos = sshdAppendLine(model);
      addOp({
        kind: 'insertAfter',
        file: pos.file,
        line: pos.line,
        text: desired,
        indent: '',
        reason: `在全局作用域末尾追加 ${t.key}`,
      });
      continue;
    }
    if (model.kind === 'sysctl') {
      // Append to the highest-precedence file so last-wins semantics apply.
      const target = t.fallbackFile;
      const lastLine = countLines(modelFileContent(model, target));
      addOp({
        kind: 'insertAfter',
        file: target,
        line: lastLine,
        text: desired,
        indent: '',
        reason: `在 ${target} 末尾追加 ${t.key}（该文件优先级最高）`,
      });
      continue;
    }
    const lastLine = countLines(modelFileContent(model, t.fallbackFile));
    addOp({
      kind: 'insertAfter',
      file: t.fallbackFile,
      line: lastLine,
      text: desired,
      indent: '',
      reason: `追加 ${t.key}`,
    });
  }

  const createFiles = [...creates.entries()].map(([file, entry]) => ({
    file,
    content: `${entry.lines.join('\n')}\n`,
    ruleIds: [...new Set(entry.ruleIds)],
  }));

  const parts: string[] = [];
  if (ops.length) parts.push(`${ops.length} 处指令修改`);
  if (createFiles.length) parts.push(`新建 ${createFiles.length} 个文件`);
  return { ops, createFiles, summary: parts.length ? parts.join('，') : '无需改动' };
}

function modelFileContent(model: ConfigFileModel, file: string): string {
  return model.contents?.[file] ?? '';
}

function countLines(content: string): number {
  if (!content) return 0;
  const lines = content.split(/\r?\n/);
  // A trailing newline creates an empty final element; anchor on the last
  // non-empty line so the new statement lands after existing content.
  let last = lines.length;
  while (last > 1 && lines[last - 1] === '') last--;
  return last;
}

export type { FixTarget };
export { renderStatement };
