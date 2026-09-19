-- CreateEnum
CREATE TYPE "DuffelFlightBookingMode" AS ENUM ('HOLD', 'INSTANT');

-- CreateEnum
CREATE TYPE "DuffelFlightBookingStatus" AS ENUM ('HELD', 'CONFIRMED', 'CANCELLED', 'FAILED');

-- AlterEnum
ALTER TYPE "BookingPaymentType" ADD VALUE 'FLIGHT';

-- CreateTable
CREATE TABLE "duffel_flight_bookings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "patient_id" TEXT,
    "lead_id" TEXT,
    "duffel_order_id" TEXT NOT NULL,
    "booking_reference" TEXT,
    "offer_id" TEXT NOT NULL,
    "mode" "DuffelFlightBookingMode" NOT NULL,
    "status" "DuffelFlightBookingStatus" NOT NULL,
    "passengers" JSONB NOT NULL,
    "slices" JSONB NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "hold_expires_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "duffel_flight_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "duffel_flight_bookings_duffel_order_id_key" ON "duffel_flight_bookings"("duffel_order_id");

-- CreateIndex
CREATE INDEX "duffel_flight_bookings_organization_id_idx" ON "duffel_flight_bookings"("organization_id");

-- CreateIndex
CREATE INDEX "duffel_flight_bookings_clinic_id_idx" ON "duffel_flight_bookings"("clinic_id");

-- CreateIndex
CREATE INDEX "duffel_flight_bookings_patient_id_idx" ON "duffel_flight_bookings"("patient_id");

-- CreateIndex
CREATE INDEX "duffel_flight_bookings_lead_id_idx" ON "duffel_flight_bookings"("lead_id");
