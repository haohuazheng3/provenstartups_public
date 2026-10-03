"use client";

import { useMemo, useState } from "react";

function parseAmount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ArrCalculator() {
  const [monthlyCustomers, setMonthlyCustomers] = useState("100");
  const [monthlyPrice, setMonthlyPrice] = useState("49");
  const [annualCustomers, setAnnualCustomers] = useState("20");
  const [annualPrice, setAnnualPrice] = useState("1200");
  const [oneTimeFees, setOneTimeFees] = useState("5000");

  const result = useMemo(() => {
    const monthlyPlanMrr = parseAmount(monthlyCustomers) * parseAmount(monthlyPrice);
    const annualPlanMrr =
      (parseAmount(annualCustomers) * parseAmount(annualPrice)) / 12;
    const mrr = monthlyPlanMrr + annualPlanMrr;
    return { monthlyPlanMrr, annualPlanMrr, mrr, arr: mrr * 12 };
  }, [annualCustomers, annualPrice, monthlyCustomers, monthlyPrice]);

  const fields = [
    ["Monthly-plan customers", monthlyCustomers, setMonthlyCustomers],
    ["Monthly price", monthlyPrice, setMonthlyPrice],
    ["Annual-plan customers", annualCustomers, setAnnualCustomers],
    ["Annual price", annualPrice, setAnnualPrice],
    ["One-time fees (excluded)", oneTimeFees, setOneTimeFees],
  ] as const;

  return (
    <section className="panel mt-7 p-6" aria-labelledby="arr-calculator-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="arr-calculator-heading" className="h-sec">
            Calculate normalized ARR
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-t3">
            Monthly plans count at their monthly price. Annual plans are divided by 12 first.
            One-time fees stay visible but never enter MRR or ARR.
          </p>
        </div>
        <span className="chip chip-brand">Runs in your browser</span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {fields.map(([label, value, setter]) => (
          <label key={label} className="text-sm text-t2">
            <span className="mb-1.5 block font-medium">{label}</span>
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={value}
              onChange={(event) => setter(event.target.value)}
              className="input"
            />
          </label>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-sheet-2 p-4">
          <div className="label">Normalized MRR</div>
          <output className="mono mt-1.5 block text-2xl font-semibold">{money(result.mrr)}</output>
          <div className="mt-1 text-xs text-t4">
            {money(result.monthlyPlanMrr)} monthly plans + {money(result.annualPlanMrr)} annual plans
          </div>
        </div>
        <div className="rounded-xl border border-money/30 bg-money-soft p-4">
          <div className="label">Annual recurring revenue</div>
          <output className="mono money mt-1.5 block text-2xl font-semibold">{money(result.arr)}</output>
          <div className="mt-1 text-xs text-t3">MRR × 12; not recognized revenue or profit</div>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-t4">
        Excluded one-time fees: {money(parseAmount(oneTimeFees))}. This calculator does not
        forecast churn, expansion, failed payments, taxes, or cash timing.
      </p>
    </section>
  );
}
