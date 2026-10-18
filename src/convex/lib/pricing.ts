import type { Doc } from "../_generated/dataModel";

export type AnswerValue = string | number;

export type Breakdown = {
  basePremium: number;
  currency: string;
  factors: { key: string; label: string; selected: string; multiplier: number }[];
  premium: number;
  termMonths: number;
};

export function validateAnswers(
  product: Doc<"products">,
  answers: Record<string, AnswerValue>,
) {
  const clean: Record<string, AnswerValue> = {};
  for (const question of product.questions) {
    const raw = answers[question.key];
    const value = typeof raw === "number" ? raw : (raw ?? "").toString().trim();
    if (question.required && (value === "" || value === undefined)) {
      throw new Error(`${question.label} is required.`);
    }
    if (value === "" || value === undefined) continue;
    if (question.type === "number") {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric < 0) {
        throw new Error(`${question.label} must be a valid number.`);
      }
      clean[question.key] = numeric;
    } else if (question.type === "date") {
      if (Number.isNaN(Date.parse(String(value)))) {
        throw new Error(`${question.label} must be a valid date.`);
      }
      clean[question.key] = String(value);
    } else if (question.type === "select") {
      if (question.options && !question.options.includes(String(value))) {
        throw new Error(`Choose a valid option for ${question.label}.`);
      }
      clean[question.key] = String(value);
    } else {
      if (String(value).length > 2000) {
        throw new Error(`${question.label} is too long.`);
      }
      clean[question.key] = String(value);
    }
  }
  return clean;
}

/** Indicative premium - deliberately deterministic. Underwriting stays manual. */
export function priceProduct(
  product: Doc<"products">,
  answers: Record<string, AnswerValue>,
): Breakdown {
  let multiplier = 1;
  const factors: Breakdown["factors"] = [];

  for (const factor of product.ratingFactors) {
    const selectedValue = answers[factor.key];
    const option =
      selectedValue === undefined
        ? undefined
        : factor.options.find(
            (candidate) => candidate.value === String(selectedValue),
          );
    if (!option) {
      throw new Error(`Choose ${factor.label.toLowerCase()} to see a premium.`);
    }
    multiplier *= option.multiplier;
    factors.push({
      key: factor.key,
      label: factor.label,
      selected: option.label,
      multiplier: option.multiplier,
    });
  }

  // Round to the nearest whole currency unit (100 minor units).
  const premium = Math.max(
    100,
    Math.round((product.basePremium * multiplier) / 100) * 100,
  );

  return {
    basePremium: product.basePremium,
    currency: product.currency,
    factors,
    premium,
    termMonths: product.termMonths,
  };
}

export function isProductOnSale(product: Doc<"products">, now = Date.now()) {
  return (
    product.status === "published" &&
    product.effectiveFrom <= now &&
    product.countries.length > 0 &&
    product.coverageLimit > 0 &&
    product.basePremium > 0
  );
}
