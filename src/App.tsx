/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  Wallet, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowDownLeft, 
  PieChart, 
  Zap, 
  ChevronRight,
  Info,
  Moon,
  Sun,
  LogIn,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  Pie,
  PieChart as RePieChart
} from 'recharts';
import { cn } from './lib/utils';
import { Transaction, TrustScore, InvestmentPlan, TransactionType } from './types';
import { analyzeTransactions, generateInvestmentBotAdvice } from './services/geminiService';
import { 
  auth, 
  db, 
  loginWithGoogle, 
  logout, 
  onAuthStateChanged, 
  User 
} from './services/firebaseService';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';

const EXCHANGE_RATE = 2800; // Taux indicatif 1 USD = 2800 FC

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: '1', date: '2024-03-20', amount: 125000, type: 'receive', description: 'Vente Boutique', category: 'Revenus' },
  { id: '2', date: '2024-03-19', amount: 45000, type: 'payment', description: 'Recharge Kadhiv', category: 'Dépenses' },
  { id: '3', date: '2024-03-18', amount: 28000, type: 'send', description: 'Envoi M-Pesa', category: 'Transfert' },
  { id: '4', date: '2024-03-17', amount: 85000, type: 'receive', description: 'Paiement Client', category: 'Revenus' },
  { id: '5', date: '2024-03-16', amount: 14000, type: 'save', description: 'Épargne Paatsh', category: 'Épargne' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [exchangeRate, setExchangeRate] = useState(2800);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState('2800');
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [score, setScore] = useState<TrustScore | null>(null);
  const [plan, setPlan] = useState<InvestmentPlan | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'credit' | 'savings'>('overview');
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // States for new transaction form
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<TransactionType>('receive');

  const formatFC = (amount: number) => `${Math.round(amount).toLocaleString()} FC`;
  const formatUSD = (amount: number) => `$${(amount / exchangeRate).toFixed(2)}`;

  const handleUpdateRate = () => {
    const rate = parseFloat(tempRate);
    if (!isNaN(rate) && rate > 0) {
      setExchangeRate(rate);
      setIsEditingRate(false);
    }
  };

  const updateAIAnalyses = async (data: Transaction[]) => {
    if (data.length === 0) {
      setLoading(false);
      return;
    }
    setRecalculating(true);
    try {
      const [scoreResult, planResult] = await Promise.all([
        analyzeTransactions(data),
        generateInvestmentBotAdvice(data, 75)
      ]);
      setScore(scoreResult);
      setPlan(planResult);
    } catch (error) {
      console.error("Analysis failed", error);
    } finally {
      setRecalculating(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setTransactions(MOCK_TRANSACTIONS);
        updateAIAnalyses(MOCK_TRANSACTIONS);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'transactions'),
      orderBy('date', 'desc')
    );

    const unsubscribeTxs = onSnapshot(q, (snapshot) => {
      const txsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      
      setTransactions(txsData.length > 0 ? txsData : MOCK_TRANSACTIONS);
      updateAIAnalyses(txsData.length > 0 ? txsData : MOCK_TRANSACTIONS);
    });

    return () => unsubscribeTxs();
  }, [user]);

  const handleAddTransaction = async () => {
    if (!newDesc || !newAmount) return;
    
    const newTxData = {
      date: new Date().toISOString().split('T')[0],
      amount: parseFloat(newAmount),
      type: newType,
      description: newDesc,
      category: newType === 'receive' ? 'Revenus' : newType === 'save' ? 'Épargne' : 'Dépenses',
      userId: user?.uid || 'guest'
    };

    if (user) {
      try {
        await addDoc(collection(db, 'users', user.uid, 'transactions'), newTxData);
      } catch (error) {
        console.error("Erreur d'ajout", error);
      }
    } else {
      const newTx = { id: Math.random().toString(36).substr(2, 9), ...newTxData };
      const updated = [newTx, ...transactions];
      setTransactions(updated);
      updateAIAnalyses(updated);
    }

    setShowAddModal(false);
    setNewDesc('');
    setNewAmount('');
  };

  const handleDeleteTransaction = async (id: string) => {
    if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'transactions', id));
      } catch (error) {
        console.error("Erreur de suppression", error);
      }
    } else {
      const updated = transactions.filter(t => t.id !== id);
      setTransactions(updated);
      updateAIAnalyses(updated);
    }
  };

  const totalIncome = transactions.filter(t => t.type === 'receive').reduce((acc, t) => acc + t.amount, 0);

  if (loading && !recalculating) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center font-sans">
        <div className="text-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-[#141414] border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-sm font-medium text-gray-500 tracking-wider uppercase">Initialisation de MyFInance RDC...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen font-sans transition-colors duration-300",
      isDarkMode ? "bg-[#0A0A0A] text-white" : "bg-[#F5F5F5] text-[#141414]"
    )}>
      {/* Recalculating Overlay */}
      <AnimatePresence>
        {recalculating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "fixed inset-0 z-[100] backdrop-blur-sm flex items-center justify-center",
              isDarkMode ? "bg-black/60" : "bg-white/60"
            )}
          >
            <div className={cn(
              "px-8 py-4 rounded-full shadow-2xl flex items-center gap-3",
              isDarkMode ? "bg-white text-black" : "bg-[#141414] text-white"
            )}>
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className={cn(
                  "w-5 h-5 border-2 border-t-transparent rounded-full",
                  isDarkMode ? "border-black" : "border-white"
                )}
              />
              <span className="text-sm font-bold tracking-tight">Mise à jour de l'analyse IA...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={cn(
                "rounded-[32px] p-8 shadow-2xl w-full max-w-md relative z-10 border transition-colors",
                isDarkMode ? "bg-[#1A1A1A] border-white/10" : "bg-white border-gray-100"
              )}
            >
              <h3 className="text-2xl font-bold mb-6">Ajouter une transaction</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-2">Description</label>
                  <input 
                    type="text" 
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Ex: Vente au Grand Marché"
                    className={cn(
                      "w-full px-4 py-3 rounded-2xl border focus:outline-none transition-colors",
                      isDarkMode ? "bg-white/5 border-white/10 focus:border-white text-white" : "bg-gray-50 border-gray-100 focus:border-[#141414]"
                    )}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-2">Montant (FC)</label>
                  <input 
                    type="number" 
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="Ex: 50000"
                    className={cn(
                      "w-full px-4 py-3 rounded-2xl border focus:outline-none transition-colors",
                      isDarkMode ? "bg-white/5 border-white/10 focus:border-white text-white" : "bg-gray-50 border-gray-100 focus:border-[#141414]"
                    )}
                  />
                  {newAmount && (
                    <p className="text-[10px] text-gray-400 font-mono mt-1">Équivalent: {formatUSD(parseFloat(newAmount))}</p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-2">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['receive', 'payment'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setNewType(t as any)}
                        className={cn(
                          "py-3 rounded-2xl border text-sm font-bold transition-all",
                          newType === t 
                            ? (isDarkMode ? "bg-white text-black border-white" : "bg-[#141414] text-white border-[#141414]")
                            : (isDarkMode ? "bg-white/5 text-gray-400 border-white/10" : "bg-white text-gray-500 border-gray-100 hover:border-gray-300")
                        )}
                      >
                        {t === 'receive' ? 'Entrée (+)' : 'Sortie (-)'}
                      </button>
                    ))}
                  </div>
                </div>
                <button 
                  onClick={handleAddTransaction}
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all mt-4",
                    isDarkMode ? "bg-white text-black" : "bg-[#141414] text-white"
                  )}
                >
                  Enregistrer et Analyser
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className={cn(
        "border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50 transition-colors",
        isDarkMode ? "bg-[#141414] border-white/10" : "bg-white border-gray-200"
      )}>
        <div className="flex items-center gap-2">
          <div className={cn("p-2 rounded-lg transition-colors", isDarkMode ? "bg-white" : "bg-[#141414]")}>
            <TrendingUp className={cn("w-5 h-5", isDarkMode ? "text-black" : "text-white")} />
          </div>
          <span className="font-bold text-xl tracking-tight">MyFInance RDC</span>
        </div>
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={cn(
              "p-2 rounded-full transition-colors",
              isDarkMode ? "bg-white/10 text-white hover:bg-white/20" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <p className="text-xs font-bold leading-none">{user.displayName}</p>
                <button 
                  onClick={logout}
                  className="text-[10px] text-red-400 hover:underline font-bold uppercase tracking-widest"
                >
                  Déconnexion
                </button>
              </div>
              <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-gray-200" alt="Avatar" />
            </div>
          ) : (
            <button 
              onClick={loginWithGoogle}
              className={cn(
                "flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full transition-all border",
                isDarkMode ? "bg-white text-black border-white" : "bg-white text-[#141414] border-gray-200 hover:bg-gray-50"
              )}
            >
              <LogIn className="w-4 h-4" />
              Connexion
            </button>
          )}
          <div className="flex flex-col items-end text-[10px] font-bold tracking-widest uppercase">
            <span className="text-gray-400">Taux indicatif</span>
            {isEditingRate ? (
              <div className="flex items-center gap-2 mt-1">
                <input 
                  type="number" 
                  value={tempRate}
                  onChange={(e) => setTempRate(e.target.value)}
                  className={cn(
                    "w-16 rounded px-1 py-0.5 focus:outline-none border transition-colors",
                    isDarkMode ? "bg-white/5 border-white/20 text-white" : "bg-gray-50 border-gray-200 text-[#141414]"
                  )}
                  autoFocus
                />
                <button onClick={handleUpdateRate} className="text-green-600 hover:text-green-700">OK</button>
                <button onClick={() => setIsEditingRate(false)} className="text-red-400 hover:text-red-500">×</button>
              </div>
            ) : (
              <div 
                onClick={() => setIsEditingRate(true)}
                className={cn(
                  "cursor-pointer px-2 py-0.5 rounded transition-all flex items-center gap-1 group",
                  isDarkMode ? "text-white hover:bg-white/5" : "text-[#141414] hover:bg-gray-50"
                )}
              >
                1 USD = {exchangeRate} FC
                <span className="opacity-0 group-hover:opacity-100 text-[8px] text-gray-400 font-normal underline ml-1">Modifier</span>
              </div>
            )}
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className={cn(
              "text-sm font-bold px-4 py-2 rounded-full hover:shadow-lg transition-all",
              isDarkMode ? "bg-white text-black" : "bg-[#141414] text-white"
            )}
          >
            + Transaction
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Sidebar / Profile Summary */}
          <div className="lg:col-span-3 space-y-6">
            <div className={cn(
              "p-6 rounded-3xl shadow-sm border transition-colors",
              isDarkMode ? "bg-[#1A1A1A] border-white/10" : "bg-white border-gray-100"
            )}>
              {user ? (
                <>
                  <div className="w-16 h-16 rounded-full mb-4 overflow-hidden border-2 border-gray-100">
                    <img src={user.photoURL || ''} className="w-full h-full object-cover" alt="Profile" />
                  </div>
                  <h2 className="text-xl font-bold">{user.displayName}</h2>
                  <p className="text-sm text-gray-400 font-medium">Utilisateur MyFInance</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-gray-500/10 rounded-full mb-4 flex items-center justify-center text-gray-500">
                    <UserIcon className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold">Invité</h2>
                  <p className="text-sm text-gray-400 font-medium italic">Connectez-vous pour sauvegarder</p>
                </>
              )}
              <div className={cn("mt-6 pt-6 border-t", isDarkMode ? "border-white/10" : "border-gray-100")}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-400 uppercase font-bold tracking-widest text-[10px]">Score de Confiance</span>
                  <span className={cn(
                    "text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1",
                    score?.rating === 'Excellent' || score?.rating === 'Bon' 
                      ? "bg-green-500/10 text-green-500" 
                      : "bg-orange-500/10 text-orange-500"
                  )}>
                    <Zap className="w-3 h-3" />
                    {score?.rating || 'Calcul...'}
                  </span>
                </div>
                <div className="text-3xl font-bold">{score?.score || 0}%</div>
                <div className={cn("w-full h-2 rounded-full mt-2 overflow-hidden", isDarkMode ? "bg-white/5" : "bg-gray-100")}>
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${score?.score}%` }}
                    className={cn("h-full transition-colors", isDarkMode ? "bg-white" : "bg-[#141414]")}
                  />
                </div>
              </div>
            </div>

            <nav className="space-y-1">
              {[
                { id: 'overview', label: 'Vue d\'ensemble', icon: PieChart },
                { id: 'credit', label: 'Score de Crédit', icon: ShieldCheck },
                { id: 'savings', label: 'Épargne & Invest.', icon: Wallet },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all",
                    activeTab === item.id 
                      ? (isDarkMode ? "bg-white text-black shadow-lg" : "bg-[#141414] text-white shadow-lg")
                      : (isDarkMode ? "hover:bg-white/5 text-gray-400" : "hover:bg-white text-gray-500")
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-9 space-y-8">
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  {/* Quick Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className={cn(
                      "p-6 rounded-3xl shadow-xl overflow-hidden relative transition-colors",
                      isDarkMode ? "bg-white text-black" : "bg-[#141414] text-white"
                    )}>
                      <Zap className={cn("absolute -right-4 -top-4 w-24 h-24", isDarkMode ? "opacity-5" : "opacity-10")} />
                      <p className={cn("text-xs font-bold mb-1 uppercase tracking-wider", isDarkMode ? "text-gray-500" : "text-gray-400")}>Revenus Totaux</p>
                      <h3 className="text-2xl font-bold">{formatFC(totalIncome)}</h3>
                      <p className={cn("text-sm mt-1 font-mono", isDarkMode ? "text-gray-500" : "text-gray-400")}>{formatUSD(totalIncome)}</p>
                    </div>
                    <div className={cn(
                      "p-6 rounded-3xl shadow-sm border transition-colors",
                      isDarkMode ? "bg-[#1A1A1A] border-white/10" : "bg-white border-gray-100"
                    )}>
                      <p className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Dernier Revenu</p>
                      <h3 className="text-2xl font-bold">{formatFC(transactions.find(t => t.type === 'receive')?.amount || 0)}</h3>
                      <p className="text-sm text-gray-500 mt-1 font-mono">{formatUSD(transactions.find(t => t.type === 'receive')?.amount || 0)}</p>
                    </div>
                    <div className={cn(
                      "p-6 rounded-3xl shadow-sm border transition-colors",
                      isDarkMode ? "bg-[#1A1A1A] border-white/10" : "bg-white border-gray-100"
                    )}>
                      <p className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Cible IA</p>
                      <p className="text-sm font-medium mt-2 leading-tight">{plan?.recommendation.slice(0, 50)}...</p>
                    </div>
                  </div>

                  {/* Chart and Activity */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className={cn(
                      "p-8 rounded-3xl shadow-sm border transition-colors",
                      isDarkMode ? "bg-[#1A1A1A] border-white/10" : "bg-white border-gray-100"
                    )}>
                      <h4 className="font-bold mb-6 flex items-center justify-between text-sm uppercase tracking-widest text-gray-400">
                        Flux de Trésorerie
                      </h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={[...transactions].reverse().map(t => ({ name: t.date, val: t.amount }))}>
                            <defs>
                              <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={isDarkMode ? "#FFFFFF" : "#141414"} stopOpacity={0.1}/>
                                <stop offset="95%" stopColor={isDarkMode ? "#FFFFFF" : "#141414"} stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <Tooltip 
                              formatter={(value: number) => [`${formatFC(value)} (${formatUSD(value)})`, 'Montant']}
                              contentStyle={{ 
                                borderRadius: '16px', 
                                border: 'none', 
                                backgroundColor: isDarkMode ? '#FFF' : '#141414', 
                                color: isDarkMode ? '#000' : '#fff' 
                              }}
                              itemStyle={{ color: isDarkMode ? '#000' : '#fff' }}
                            />
                            <Area type="monotone" dataKey="val" stroke={isDarkMode ? "#FFFFFF" : "#141414"} strokeWidth={2} fillOpacity={1} fill="url(#colorVal)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className={cn(
                      "p-8 rounded-3xl shadow-sm border overflow-hidden flex flex-col transition-colors",
                      isDarkMode ? "bg-[#1A1A1A] border-white/10" : "bg-white border-gray-100"
                    )}>
                      <h4 className="font-bold mb-6 text-sm uppercase tracking-widest text-gray-400">Transactions Récentes</h4>
                      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {transactions.map((t) => (
                          <div key={t.id} className="flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "p-3 rounded-2xl transition-colors",
                                t.type === 'receive' 
                                  ? (isDarkMode ? "bg-green-500/10" : "bg-green-50")
                                  : (isDarkMode ? "bg-white/5" : "bg-gray-50")
                              )}>
                                {t.type === 'receive' 
                                  ? <ArrowDownLeft className={cn("w-4 h-4", t.type === 'receive' ? "text-green-500" : "text-gray-400")} /> 
                                  : <ArrowUpRight className="w-4 h-4 text-gray-400" />
                                }
                              </div>
                              <div>
                                <p className="text-sm font-bold">{t.description}</p>
                                <p className="text-[10px] text-gray-500 tracking-wider uppercase font-mono">{t.date}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className={cn("text-xs font-bold", t.type === 'receive' ? "text-green-500" : (isDarkMode ? "text-white" : "text-[#141414]"))}>
                                  {t.type === 'receive' ? '+' : '-'}{t.amount.toLocaleString()} FC
                                </p>
                                <button 
                                  onClick={() => handleDeleteTransaction(t.id)}
                                  className="text-[10px] text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  Supprimer
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'credit' && (
                <motion.div
                  key="credit"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <div className={cn(
                    "p-8 rounded-3xl shadow-sm border transition-colors",
                    isDarkMode ? "bg-[#1A1A1A] border-white/10" : "bg-white border-gray-100"
                  )}>
                    <div className="flex items-start justify-between mb-8">
                      <div>
                        <h2 className="text-2xl font-bold mb-2">Score de Confiance RDC</h2>
                        <p className="text-gray-400 max-w-sm text-sm">Votre score est mis à jour dynamiquement à chaque nouvelle transaction enregistrée.</p>
                      </div>
                      <div className={cn(
                        "p-4 rounded-3xl flex items-center gap-2 transition-colors",
                        isDarkMode ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"
                      )}>
                        <ShieldCheck className="w-5 h-5" />
                        <span className="font-bold text-sm">Analyse Directe</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                      <div className={cn(
                        "p-8 rounded-3xl border text-center transition-colors",
                        isDarkMode ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-100"
                      )}>
                        <div className="relative inline-block">
                          <svg className="w-48 h-48 transform -rotate-90">
                            <circle cx="96" cy="96" r="88" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "#E5E7EB"} strokeWidth="12" />
                            <motion.circle 
                              cx="96" cy="96" r="88" 
                              fill="none" 
                              stroke={isDarkMode ? "#FFF" : "#141414"} 
                              strokeWidth="12" 
                              strokeDasharray="552.92"
                              animate={{ strokeDashoffset: 552.92 * (1 - (score?.score || 0) / 100) }}
                              transition={{ duration: 1.5, ease: "easeOut" }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-5xl font-black">{score?.score || 0}</span>
                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mt-1">Sur 100</span>
                          </div>
                        </div>
                        <h3 className="text-xl font-bold mt-6">Évaluation: {score?.rating}</h3>
                      </div>

                      <div className="space-y-6">
                        <div className={cn(
                          "p-6 rounded-3xl italic text-sm text-gray-400 leading-relaxed shadow-sm transition-colors",
                          isDarkMode ? "bg-white/5 border border-white/10" : "bg-white border border-gray-100"
                        )}>
                          "{score?.analysis}"
                        </div>
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Détails de l'Analyse</h4>
                          {score?.factors.map((f, i) => (
                            <div key={i} className={cn(
                              "flex gap-4 p-4 rounded-2xl border transition-colors",
                              isDarkMode ? "bg-white/5 border-white/5" : "bg-white border-gray-50"
                            )}>
                              <div className={cn(
                                "mt-1 w-2 h-2 rounded-full shrink-0",
                                f.impact === 'positive' ? "bg-green-500" : f.impact === 'negative' ? "bg-red-500" : "bg-gray-500"
                              )} />
                              <div>
                                <p className="text-xs font-bold">{f.label}</p>
                                <p className="text-[10px] text-gray-500 leading-tight mt-1">{f.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'savings' && (
                <motion.div
                  key="savings"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <div className={cn(
                    "p-8 rounded-3xl shadow-xl overflow-hidden relative transition-colors",
                    isDarkMode ? "bg-white text-black" : "bg-[#141414] text-white"
                  )}>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-8">
                      <div className="max-w-xl">
                        <h2 className="text-3xl font-bold mb-4">Conseiller d'Épargne</h2>
                        <p className={cn("text-sm italic mb-6 leading-relaxed", isDarkMode ? "text-gray-500" : "text-gray-300")}>
                          {plan?.recommendation}
                        </p>
                        <div className="flex gap-4">
                          <button className={cn(
                            "px-6 py-3 rounded-full font-bold text-sm transition-colors text-white",
                            isDarkMode ? "bg-black" : "bg-white text-black"
                          )}>
                            Activer l'Épargne
                          </button>
                          <button className={cn(
                            "px-6 py-3 rounded-full font-bold text-sm backdrop-blur-sm transition-colors",
                            isDarkMode ? "bg-black/10 text-black border border-black/10" : "bg-white/10 text-white"
                          )}>
                            Simuler au taux du jour
                          </button>
                        </div>
                      </div>
                      <div className={cn(
                        "p-8 rounded-3xl text-center md:min-w-[240px] shadow-2xl transition-colors text-[#141414]",
                        isDarkMode ? "bg-black text-white" : "bg-white text-black"
                      )}>
                        <p className={cn("text-[10px] uppercase font-bold mb-2 tracking-widest", isDarkMode ? "text-gray-500" : "text-gray-400")}>Épargne Quotidienne</p>
                        <div className="text-3xl font-black mb-1">{formatFC(plan?.dailySavings || 0)}</div>
                        <p className={cn("text-xs font-mono font-bold mb-4 uppercase", isDarkMode ? "text-gray-500" : "text-gray-400")}>{formatUSD(plan?.dailySavings || 0)}</p>
                        <div className={cn(
                          "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest inline-block",
                          isDarkMode ? "bg-green-500/20 text-green-400" : "bg-green-50 text-green-700"
                        )}>
                          Risque {plan?.riskLevel}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className={cn(
                      "p-6 rounded-3xl border transition-colors",
                      isDarkMode ? "bg-[#1A1A1A] border-white/10" : "bg-white border-gray-100"
                    )}>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Hebdo</p>
                      <p className="text-lg font-bold">{formatFC(plan?.weeklyGoal || 0)}</p>
                    </div>
                    <div className={cn(
                      "p-6 rounded-3xl border transition-colors",
                      isDarkMode ? "bg-[#1A1A1A] border-white/10" : "bg-white border-gray-100"
                    )}>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Croissance</p>
                      <p className="text-lg font-bold text-green-500">+{plan?.projectedReturn}%</p>
                    </div>
                    <div className={cn(
                      "p-6 rounded-3xl border transition-colors",
                      isDarkMode ? "bg-[#1A1A1A] border-white/10" : "bg-white border-gray-100"
                    )}>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Objectif Crédit</p>
                      <p className="text-lg font-bold">500 USD</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}


