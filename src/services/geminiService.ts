import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, TrustScore, InvestmentPlan } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const TRUST_SCORE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER, description: "Score de 0 à 100" },
    rating: { type: Type.STRING, enum: ["Bas", "Moyen", "Bon", "Excellent"] },
    analysis: { type: Type.STRING, description: "Résumé de l'analyse en français" },
    factors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          impact: { type: Type.STRING, enum: ["positive", "negative", "neutral"] },
          description: { type: Type.STRING }
        },
        required: ["label", "impact", "description"]
      }
    }
  },
  required: ["score", "rating", "analysis", "factors"]
};

const INVESTMENT_PLAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    dailySavings: { type: Type.NUMBER },
    weeklyGoal: { type: Type.NUMBER },
    projectedReturn: { type: Type.NUMBER },
    riskLevel: { type: Type.STRING, enum: ["Faible", "Modéré", "Élevé"] },
    recommendation: { type: Type.STRING }
  },
  required: ["dailySavings", "weeklyGoal", "projectedReturn", "riskLevel", "recommendation"]
};

export async function analyzeTransactions(transactions: Transaction[]): Promise<TrustScore> {
  const prompt = `Analyse les transactions suivantes pour un commerçant ou travailleur informel. 
  Traduis ces traces numériques en un score de confiance de crédit (solvabilité).
  L'analyse doit être encourageante et professionnelle.
  
  Transactions: ${JSON.stringify(transactions)}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: TRUST_SCORE_SCHEMA,
    },
  });

  return JSON.parse(response.text || "{}") as TrustScore;
}

export async function generateInvestmentBotAdvice(transactions: Transaction[], trustScore: number): Promise<InvestmentPlan> {
  const prompt = `En tant que bot de micro-investissement, propose un plan d'épargne automatisé basé sur ces transactions et ce score de confiance (${trustScore}).
  Le but est de favoriser l'inclusion financière.
  
  Transactions: ${JSON.stringify(transactions)}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: INVESTMENT_PLAN_SCHEMA,
    },
  });

  return JSON.parse(response.text || "{}") as InvestmentPlan;
}
