export type ScopeFrame = { kind: 'module' | 'class' | 'function'; name: string; indent: number };

export class ScopeStack {
  private stack: ScopeFrame[] = [];
  push(f: ScopeFrame) { this.stack.push(f); }
  popUntilIndent(indent: number) {
    while (this.stack.length > 0 && indent <= this.stack[this.stack.length - 1].indent) this.stack.pop();
  }
  current(): ScopeFrame | null { return this.stack.length ? this.stack[this.stack.length - 1] : null; }
  currentClass(): string | null {
    for (let i = this.stack.length - 1; i >= 0; i--) if (this.stack[i].kind === 'class') return this.stack[i].name;
    return null;
  }
  currentFunction(): string | null {
    for (let i = this.stack.length - 1; i >= 0; i--) if (this.stack[i].kind === 'function') return this.stack[i].name;
    return null;
  }
}

