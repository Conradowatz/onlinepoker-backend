import {Card} from "../../src/Card";
import {inspect} from "util";
import colors = module

export class Hand {

  colorValueCards: Card[];
  valueColorCards: Card[];
  winnerCards: Card[];
  bigValue: number; //the type of this hand (Flush, Straight, ...)
  smallValue: number[]; //the value of the certain type
  

  constructor(public playerIndex: number, communityCards: Card[], holeCards: Card[]) {
    //fill temporary card memory
    this.colorValueCards = [];
    this.colorValueCards.concat(communityCards);
    this.colorValueCards.concat(holeCards);
    this.valueColorCards = [];
    this.valueColorCards.concat(this.valueColorCards);
    //sort them
    this.colorValueCards.sort((a, b) => a.color==b.color?a.value-b.value:a.color-b.color);
    this.valueColorCards.sort((a, b) => a.value==b.value?a.color-b.color:a.value-b.value);
    //calculate hand value
    this.calculateValue();
  }
  
  getValueName():string {
    switch (this.bigValue) {
      case 0: return "High Card";
      case 1: return "Pair";
      case 2: return "Two Pair";
      case 3: return "Trips";
      case 4: return "Straight";
      case 5: return "Flush";
      case 6: return "Full House";
      case 7: return "Quads";
      case 8: return "Straight Flush";
      case 9: return "Royal Flush";
    }
  }

  private calculateValue() {
    this.bigValue = 0;
    if (this.straight()) {
      if (this.straightFlush()) {
        this.royaleFlush();
      }
    }
    if (this.bigValue<7 && this.pair()) {
      if (this.trips()) {
        if (!this.fullHouse()) {
          this.quads();
        }
      } else {
        this.twoPair();
      }
    }
    if (this.bigValue<5) {
      this.flush()
    }
    if (this.bigValue==0) {
      this.highCard();
    }
  }

  private straight():boolean {
    //check
    let inARow = 1;
    this.winnerCards = [this.valueColorCards[0]];
    for (let i=1; i<7; i++) {
      let cardA = this.valueColorCards[i-1];
      let cardB = this.valueColorCards[i];
      if (cardA.value!=cardB.value) {
        if (cardA.value-1==cardB.value) { //TODO Sonderfall Ass als etzte Stelle
          inARow++;
          if (inARow==5) break;
          this.winnerCards.push(cardB);
        } else {
          inARow = 1;
          this.winnerCards = [cardA];
        }
      }
    }
    //assign
    let isStraight = inARow==5;
    if (isStraight) {
      this.bigValue = 4;
      this.smallValue = [];
      for (let winnerCard of this.winnerCards) {
        this.smallValue.push(winnerCard.value);
      }
    }
    return isStraight;
  }
}