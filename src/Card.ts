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
}