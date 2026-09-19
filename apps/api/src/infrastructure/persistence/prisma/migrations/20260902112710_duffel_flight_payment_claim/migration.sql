-- AlterEnum
ALTER TYPE "DuffelFlightBookingStatus" ADD VALUE 'PAYMENT_IN_PROGRESS';

-- AlterTable
ALTER TABLE "duffel_flight_bookings" ADD COLUMN     "payment_claimed_at" TIMESTAMP(3);
