-- Server-authoritative 18+ attestation — ADDITIVE-ONLY.
-- Persist the date of birth the user attests to and when they attested, so a
-- returning (already-attested) user is never re-shown the attestation gate.
-- Both columns are nullable: a NULL date_of_birth means "not yet attested".
-- Nothing existing is altered or dropped.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "date_of_birth" DATE;
ALTER TABLE "users" ADD COLUMN "attested_at" TIMESTAMP(3);
