// Hand, draw pile and discard pile for one fighter. GDD §5.4.
// Cards are stored as card id strings. Deadlines are in battle simulation ticks (unfrozen ticks).

/** Expand a data deck [{card_id, count}] into a flat list of card ids. */
export function expandDeck(deckEntries) {
  const list = [];
  for (const e of deckEntries) {
    for (let i = 0; i < e.count; i++) list.push(e.card_id);
  }
  return list;
}

export class Deck {
  /** Create a deck from a flat card id list. Call reset() to shuffle and draw. */
  constructor(handSize) {
    this.handSize = handSize;
    this.hand = [];        // card id or null per slot
    this.refillAt = [];    // sim tick when an empty slot refills (-1 = not waiting)
    this.draw = [];        // top of the pile = last element
    this.discard = [];
    for (let i = 0; i < handSize; i++) {
      this.hand.push(null);
      this.refillAt.push(-1);
    }
  }

  /** Replace the whole deck with `cardIds`: shuffle with rng and draw a full hand at once. */
  reset(cardIds, rng) {
    this.draw = rng.shuffle(cardIds.slice());
    this.discard = [];
    for (let i = 0; i < this.handSize; i++) {
      this.hand[i] = null;
      this.refillAt[i] = -1;
    }
    for (let i = 0; i < this.handSize; i++) this.hand[i] = this.drawOne(rng);
  }

  /** Take the top card, reshuffling the discard pile if the draw pile is empty. Null if both are empty. */
  drawOne(rng) {
    if (this.draw.length === 0) {
      if (this.discard.length === 0) return null;
      this.draw = rng.shuffle(this.discard);
      this.discard = [];
    }
    return this.draw.pop();
  }

  /** Remove the card in `slot` (it goes to discard) and schedule the refill. Returns the card id. */
  play(slot, nowTick, refillTicks) {
    const id = this.hand[slot];
    this.hand[slot] = null;
    this.discard.push(id);
    this.refillAt[slot] = nowTick + refillTicks;
    return id;
  }

  /** Fill every slot whose refill time has come. Returns the list of refilled slot indexes. */
  update(nowTick, rng) {
    const filled = [];
    for (let i = 0; i < this.handSize; i++) {
      if (this.hand[i] === null && this.refillAt[i] >= 0 && nowTick >= this.refillAt[i]) {
        const id = this.drawOne(rng);
        if (id !== null) { // else: retry next tick (GDD §5.4 edge case)
          this.hand[i] = id;
          this.refillAt[i] = -1;
          filled.push(i);
        }
      }
    }
    return filled;
  }

  /** Count copies of a card currently in the hand. */
  countInHand(cardId) {
    let n = 0;
    for (const c of this.hand) if (c === cardId) n++;
    return n;
  }
}
