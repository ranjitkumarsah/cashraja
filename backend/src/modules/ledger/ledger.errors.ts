export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InsufficientBalanceError extends LedgerError {
  constructor(
    public readonly userId: string,
    public readonly requested: number,
    public readonly available: number,
  ) {
    super(`Insufficient balance for user ${userId}: requested ${requested}, available ${available}`);
  }
}

export class LedgerUserNotFoundError extends LedgerError {
  constructor(public readonly userId: string) {
    super(`User ${userId} not found for ledger operation`);
  }
}

export class LedgerEntryNotFoundError extends LedgerError {
  constructor(public readonly ledgerId: string) {
    super(`Ledger entry ${ledgerId} not found`);
  }
}

export class InvalidLedgerAmountError extends LedgerError {
  constructor(message: string) {
    super(message);
  }
}
