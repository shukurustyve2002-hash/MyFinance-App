export type TransactionType = 'receive' | 'send' | 'payment' | 'save';

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: TransactionType;
  description: string;
  category: string;
}

export interface TrustScore {
  score: number; // 0 to 100
  rating: 'Bas' | 'Moyen' | 'Bon' | 'Excellent';
  analysis: string;
  factors: {
    label: string;
    impact: 'positive' | 'negative' | 'neutral';
    description: string;
  }[];
}

export interface InvestmentPlan {
  dailySavings: number;
  weeklyGoal: number;
  projectedReturn: number;
  riskLevel: 'Faible' | 'Modéré' | 'Élevé';
  recommendation: string;
}

export interface UserProfile {
  id: string;
  name: string;
  profession: string;
  location: string;
  joinedAt: string;
}
