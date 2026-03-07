import {PracticeProfile} from './PracticeProfile';
export class TargetGenerator {
  static generatePracticeTargets(p:PracticeProfile){
    const s=new Set<number>();
    for(const m of p.multipliers){
      for(let i=p.coMin;i<=p.coMax;i++){
        s.add(m*i);
      }
    }
    return Array.from(s).sort((a,b)=>a-b);
  }
  static generateFreePlayTarget() {
    return Math.floor(Math.random() * 90) + 10;
  }
}
