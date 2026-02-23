
export interface ChainNode {
  r: number;
  c: number;
  val: number;
  id: string;
}

export class ChainSelector {
  private chain: ChainNode[] = [];
  
  start(node: ChainNode) {
    this.chain = [node];
  }

  addToChain(node: ChainNode): boolean {
    // Check if already in chain
    if (this.chain.some(n => n.id === node.id)) {
      // If backtracking to the previous node, remove the last one (undo)
      if (this.chain.length > 1 && this.chain[this.chain.length - 2].id === node.id) {
        this.chain.pop();
        return true;
      }
      return false; // Already selected, ignore
    }

    // Check adjacency
    const last = this.chain[this.chain.length - 1];
    const dr = Math.abs(last.r - node.r);
    const dc = Math.abs(last.c - node.c);
    
    // Orthogonal or Diagonal adjacency (Chebyshev distance <= 1)
    if (dr <= 1 && dc <= 1) {
      this.chain.push(node);
      return true;
    }
    
    return false;
  }

  getChain(): ChainNode[] {
    return this.chain;
  }

  clear() {
    this.chain = [];
  }

  evaluateProduct(): number {
    if (this.chain.length === 0) return 0;
    return this.chain.reduce((acc, node) => acc * node.val, 1);
  }
}
