export class Card {

  highlighted = false;

  constructor(public color: number, public value: number) {

  }

  getValueName():string {
    switch (this.value) {
      case 1: return "A";
      case 11: return "J";
      case 12: return "Q";
      case 13: return "K";
      case 14: return "A";
      default: return this.value.toString();
    }
  }

  getColorName():string {
    switch (this.color) {
      case 0: return "H";
      case 1: return "D";
      case 2: return "C";
      case 3: return "S";
    }
  }

  getSolverString():string {
    let result = "";
    switch (this.value) {
      case 1: result+="a"; break;
      case 10: result+="t"; break;
      case 11: result+="j"; break;
      case 12: result+="q"; break;
      case 13: result+="k"; break;
      case 14: result+="a"; break;
      default: result+=this.value.toString();
    }
    switch (this.color) {
      case 0: result+="h"; break;
      case 1: result+="d"; break;
      case 2: result+="c"; break;
      case 3: result+="s";
    }
    return result;
  }
}