export function estimateBudget(input: {
  flight_total: { amount: number; currency: string };
  hotel_total: { amount: number; currency: string };
  local_transport_total: { amount: number; currency: string };
  days: number;
  traveler_count: number;
  food_per_day: { amount: number; currency: string };
  activity_buffer: { amount: number; currency: string };
}) {
  const foodTotal = roundToTwo(input.food_per_day.amount * input.days * input.traveler_count);
  const grandTotal = roundToTwo(
    input.flight_total.amount +
      input.hotel_total.amount +
      input.local_transport_total.amount +
      foodTotal +
      input.activity_buffer.amount,
  );
  return {
    status: "ok",
    as_of: new Date().toISOString(),
    summary: {
      transport_total: {
        amount: roundToTwo(input.flight_total.amount + input.local_transport_total.amount),
        currency: input.flight_total.currency,
      },
      lodging_total: input.hotel_total,
      food_total: {
        amount: foodTotal,
        currency: input.food_per_day.currency,
      },
      activity_buffer: input.activity_buffer,
      grand_total: {
        amount: grandTotal,
        currency: input.flight_total.currency,
      },
    },
  };
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}
