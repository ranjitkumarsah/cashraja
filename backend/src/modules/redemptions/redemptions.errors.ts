import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

/** Gift card missing or disabled. */
export class GiftCardUnavailableException extends BadRequestException {
  constructor() {
    super('Gift card is not available for redemption');
  }
}

/** Redemption row not found (or not owned by the caller). */
export class RedemptionNotFoundException extends NotFoundException {
  constructor() {
    super('Redemption not found');
  }
}

/** Attempted status change the machine forbids (e.g. reject an issued card). */
export class IllegalRedemptionTransitionException extends ConflictException {
  constructor(from: string, to: string) {
    super(`Illegal redemption transition ${from} → ${to}`);
  }
}

/** Banned user tried to redeem, or approval blocked because the user is banned. */
export class UserBannedException extends ForbiddenException {
  constructor(message = 'User is banned') {
    super(message);
  }
}
