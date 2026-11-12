export type SampleSizeInputs = {
  confidenceLevel: 90 | 95 | 99;
  proportionEstimate: number;
  marginOfError: number;
  populationSize?: number;
  nonresponseRate: number;
};

export type SampleSizeResult = {
  z: number;
  p: number;
  q: number;
  d: number;
  initialUnrounded: number;
  initialSample: number;
  finitePopulationUnrounded?: number;
  finitePopulationSample?: number;
  adjustedUnrounded: number;
  finalSample: number;
};

const Z_VALUES: Record<SampleSizeInputs["confidenceLevel"], number> = {
  90: 1.645,
  95: 1.96,
  99: 2.576,
};

export function calculateSampleSize(input: SampleSizeInputs): SampleSizeResult {
  const { confidenceLevel, proportionEstimate, marginOfError, populationSize, nonresponseRate } = input;
  if (![90, 95, 99].includes(confidenceLevel)) throw new Error("Choose a supported confidence level.");
  if (!Number.isFinite(proportionEstimate) || proportionEstimate <= 0 || proportionEstimate >= 100) {
    throw new Error("The expected proportion must be greater than 0% and less than 100%.");
  }
  if (!Number.isFinite(marginOfError) || marginOfError <= 0 || marginOfError >= 100) {
    throw new Error("The margin of error must be greater than 0% and less than 100%.");
  }
  if (!Number.isFinite(nonresponseRate) || nonresponseRate < 0 || nonresponseRate >= 100) {
    throw new Error("The nonresponse allowance must be from 0% to less than 100%.");
  }
  if (populationSize !== undefined && (!Number.isInteger(populationSize) || populationSize <= 0)) {
    throw new Error("The eligible population must be a positive whole number, or left blank if unknown.");
  }

  const z = Z_VALUES[confidenceLevel];
  const p = proportionEstimate / 100;
  const q = 1 - p;
  const d = marginOfError / 100;
  const initialUnrounded = (z * z * p * q) / (d * d);
  const initialSample = Math.ceil(initialUnrounded);
  let finitePopulationUnrounded: number | undefined;
  let finitePopulationSample: number | undefined;
  let base = initialSample;

  if (populationSize !== undefined) {
    finitePopulationUnrounded = initialUnrounded / (1 + (initialUnrounded - 1) / populationSize);
    finitePopulationSample = Math.ceil(finitePopulationUnrounded);
    base = finitePopulationSample;
  }

  const responseFraction = 1 - nonresponseRate / 100;
  const adjustedUnrounded = base / responseFraction;
  const finalSample = Math.ceil(adjustedUnrounded);
  return {
    z,
    p,
    q,
    d,
    initialUnrounded,
    initialSample,
    finitePopulationUnrounded,
    finitePopulationSample,
    adjustedUnrounded,
    finalSample,
  };
}

export function sampleSizeSectionText(input: SampleSizeInputs): string {
  const result = calculateSampleSize(input);
  const percent = (value: number) => `${Number(value.toFixed(2))}%`;
  const lines = [
    "The sample size for estimating one population proportion was calculated using Cochran’s formula.",
    "n₀ = Z² × p × q ÷ d²",
    `Where: Z = ${result.z} for a ${input.confidenceLevel}% confidence level; p = ${percent(input.proportionEstimate)}; q = 1 − p = ${percent((1 - result.p) * 100)}; and d = ${percent(input.marginOfError)}.`,
    `Substitution: n₀ = (${result.z}² × ${result.p.toFixed(2)} × ${result.q.toFixed(2)}) ÷ (${result.d.toFixed(3)}²) = ${result.initialUnrounded.toFixed(2)}. The initial sample size is rounded up to ${result.initialSample}.`,
  ];

  let base = result.initialSample;
  if (input.populationSize !== undefined && result.finitePopulationUnrounded !== undefined && result.finitePopulationSample !== undefined) {
    lines.push(
      `Because the eligible population is finite (N = ${input.populationSize}), the finite-population correction was applied: n = n₀ ÷ [1 + (n₀ − 1) ÷ N] = ${result.finitePopulationUnrounded.toFixed(2)}, rounded up to ${result.finitePopulationSample}.`,
    );
    base = result.finitePopulationSample;
  } else {
    lines.push("The finite-population correction was not applied because no verified eligible-population count was provided.");
  }

  if (input.nonresponseRate > 0) {
    lines.push(
      `A ${percent(input.nonresponseRate)} nonresponse allowance was added: final n = ${base} ÷ (1 − ${input.nonresponseRate / 100}) = ${result.adjustedUnrounded.toFixed(2)}, rounded up to ${result.finalSample} participants.`,
    );
  } else {
    lines.push(`The final required sample is ${result.finalSample} participants.`);
  }
  return lines.join("\n\n");
}
