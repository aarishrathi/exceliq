/**
 * AI Analysis Layer — uses Anthropic Claude via Vercel AI SDK.
 * Produces: change summaries, inferred intent, anomaly detection.
 * All inferred content is labeled [Inference] in outputs.
 */

import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { SemanticDiff, AnomalyFlag } from '@/types/workbook';
import { v4 as uuidv4 } from 'uuid';

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = 'claude-sonnet-4-5';

/**
 * Generates a plain-English summary of a semantic diff.
 * Returns a string with [Inference] labels where appropriate.
 */
export async function generateDiffSummary(
  diff: SemanticDiff,
  fileName: string,
  uploadedBy: string
): Promise<string> {
  if (diff.totalChanges === 0) {
    return 'No changes detected between this version and the previous version.';
  }

  const prompt = `You are an expert Excel workbook auditor. You have been given a semantic diff of an Excel file.

File: ${fileName}
Uploaded by: ${uploadedBy}

Semantic diff summary:
- Cell formula changes: ${diff.cellChanges.filter((c) => c.changeType === 'formula_changed').length}
- Cell value changes: ${diff.cellChanges.filter((c) => c.changeType === 'value_changed').length}
- Structural changes: ${diff.structuralChanges.length}
- VBA module changes: ${diff.vbaChanges.length}

Top cell changes (first 20):
${JSON.stringify(diff.cellChanges.slice(0, 20), null, 2)}

Structural changes:
${JSON.stringify(diff.structuralChanges, null, 2)}

Write a concise 3-5 sentence plain-English summary of what changed. 
For any inferred reasons or intent, prefix with "[Inference]". 
Do not speculate without labeling. Be factual about what changed, and cautious about why.`;

  if (!process.env.ANTHROPIC_API_KEY) {
    return buildRuleBasedSummary(diff, fileName, uploadedBy);
  }

  try {
    const { text } = await generateText({
      model: anthropic(MODEL),
      prompt,
      maxTokens: 500,
    });
    return text;
  } catch (err) {
    console.warn('[ai] generateDiffSummary failed, using rule-based fallback:', err);
    return buildRuleBasedSummary(diff, fileName, uploadedBy);
  }
}

function buildRuleBasedSummary(
  diff: SemanticDiff,
  fileName: string,
  uploadedBy: string
): string {
  const formulaChanges = diff.cellChanges.filter(
    (c) => c.changeType === 'formula_changed'
  ).length;
  const valueChanges = diff.cellChanges.filter(
    (c) => c.changeType === 'value_changed'
  ).length;

  return [
    `${fileName} uploaded by ${uploadedBy} has ${diff.totalChanges} change(s).`,
    `${formulaChanges} formula change(s), ${valueChanges} value change(s), and ${diff.structuralChanges.length} structural change(s).`,
    diff.structuralChanges.length > 0
      ? `Structural: ${diff.structuralChanges.map((s) => s.detail).slice(0, 3).join('; ')}.`
      : null,
    '[Inference] AI summary unavailable — showing deterministic change counts instead.',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Detects anomalies in a semantic diff and returns structured flags.
 * All AI-inferred causes are labeled [Inference].
 */
export async function detectAnomalies(
  diff: SemanticDiff,
  fileName: string
): Promise<AnomalyFlag[]> {
  const flags: AnomalyFlag[] = [];

  // Rule-based detection (deterministic, no inference label needed)
  for (const change of diff.cellChanges) {
    // Hardcoded override: formula replaced by value
    if (change.oldFormula && !change.newFormula) {
      flags.push({
        id: uuidv4(),
        severity: 'critical',
        category: 'hardcoded_override',
        title: 'Formula Overridden by Hardcoded Value',
        description: `Cell ${change.cell} on sheet "${change.sheet}" had formula "${change.oldFormula}" replaced with hardcoded value "${change.newValue}".`,
        affectedCell: change.cell,
        affectedSheet: change.sheet,
        status: 'open',
      });
    }

    // REF errors
    if (String(change.newValue).includes('#REF!') || String(change.newFormula).includes('#REF!')) {
      flags.push({
        id: uuidv4(),
        severity: 'critical',
        category: 'ref_error',
        title: '#REF! Error Detected',
        description: `Cell ${change.cell} on sheet "${change.sheet}" contains a #REF! error after this upload.`,
        affectedCell: change.cell,
        affectedSheet: change.sheet,
        status: 'open',
      });
    }

    // Large numeric deviation
    if (change.deviationPercent !== undefined && change.deviationPercent > 50) {
      flags.push({
        id: uuidv4(),
        severity: 'warning',
        category: 'value_outlier',
        title: 'Large Numeric Deviation',
        description: `Cell ${change.cell} on sheet "${change.sheet}" changed by ${change.deviationPercent.toFixed(1)}% (${change.oldValue} → ${change.newValue}).`,
        affectedCell: change.cell,
        affectedSheet: change.sheet,
        status: 'open',
      });
    }
  }

  // Structural: sheet removed
  for (const structural of diff.structuralChanges) {
    if (structural.changeType === 'sheet_removed') {
      flags.push({
        id: uuidv4(),
        severity: 'critical',
        category: 'structural_deletion',
        title: 'Sheet Deleted',
        description: structural.detail,
        status: 'open',
      });
    }
  }

  // If there are high-severity flags and Anthropic is configured, ask AI to infer causes
  const criticalFlags = flags.filter((f) => f.severity === 'critical');
  if (
    process.env.ANTHROPIC_API_KEY &&
    criticalFlags.length > 0 &&
    diff.totalChanges > 0
  ) {
    const enriched = await enrichFlagsWithAI(criticalFlags, diff, fileName);
    return [...enriched, ...flags.filter((f) => f.severity !== 'critical')];
  }

  return flags;
}

async function enrichFlagsWithAI(
  flags: AnomalyFlag[],
  diff: SemanticDiff,
  fileName: string
): Promise<AnomalyFlag[]> {
  const prompt = `You are an expert Excel auditor. Below are critical anomaly flags detected in file "${fileName}".

For each flag, provide a brief [Inference] of the most likely cause (1-2 sentences max).
Always prefix inferred content with "[Inference]".
Do not state inferences as facts.

Flags:
${JSON.stringify(flags.map((f) => ({ id: f.id, title: f.title, description: f.description })), null, 2)}

Respond as a JSON array with objects: { "id": "...", "aiInferredCause": "[Inference] ..." }`;

  try {
    const { text } = await generateText({
      model: anthropic(MODEL),
      prompt,
      maxTokens: 800,
    });

    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return flags;

    const enrichments: { id: string; aiInferredCause: string }[] = JSON.parse(jsonMatch[0]);
    return flags.map((flag) => {
      const enrichment = enrichments.find((e) => e.id === flag.id);
      return enrichment ? { ...flag, aiInferredCause: enrichment.aiInferredCause } : flag;
    });
  } catch {
    return flags;
  }
}
